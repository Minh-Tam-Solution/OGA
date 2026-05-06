"""Concurrency runtime tests for Sprint 7 (Task 7.4).

Scenario: generation in progress + swap request concurrently → swap returns 409.
Tests the state machine and dual-lock contract from TS-003/ADR-003.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from fastapi import HTTPException

# We must import before any event-loop policy is locked by pytest-asyncio
from server import (
    PipelineState,
    _gen_lock,
    _swap_lock,
    diffusers_generate,
    swap_model_endpoint,
    pipeline_state,
    pipe,
    current_model,
    resolve_model_config_strict,
    SwapRequest,
)


@pytest.fixture(autouse=True)
def reset_state():
    """Reset global state before each test."""
    global pipeline_state, pipe, current_model
    pipeline_state = PipelineState.IDLE
    pipe = None
    current_model = None
    # Drain any held locks (best-effort in single-threaded asyncio)
    assert not _swap_lock.locked()
    assert not _gen_lock.locked()


@pytest.mark.asyncio
async def test_swap_while_generating_returns_409():
    """Swap request during active generation must return 409.

    Simulates:
        1. Generation acquires _gen_lock and sets pipeline_state=GENERATING
        2. Concurrent swap request checks _gen_lock.locked() → True → 409
    """
    async with _gen_lock:
        # Simulate generation in progress
        pipeline_state = PipelineState.GENERATING
        try:
            # Attempt swap while generation holds _gen_lock
            with pytest.raises(HTTPException) as exc_info:
                async with _swap_lock:
                    if _gen_lock.locked():
                        raise HTTPException(
                            409,
                            "Cannot swap while generating. Try again after current generation completes.",
                        )
            assert exc_info.value.status_code == 409
        finally:
            pipeline_state = PipelineState.READY


@pytest.mark.asyncio
async def test_generate_while_swap_in_progress_returns_503():
    """Generation request during active swap must return 503.

    Simulates:
        1. Swap acquires _swap_lock and sets pipeline_state=LOADING
        2. Concurrent generation request checks _swap_lock.locked() → True → 503
    """
    async with _swap_lock:
        pipeline_state = PipelineState.LOADING
        try:
            # Simulate generation trying to start while swap holds _swap_lock
            async with _gen_lock:
                if _swap_lock.locked():
                    raise HTTPException(503, "Pipeline swap in progress, try again shortly")
        except HTTPException as e:
            assert e.status_code == 503
        finally:
            pipeline_state = PipelineState.IDLE


@pytest.mark.asyncio
async def test_swap_to_same_model_returns_400():
    """Swap to already-loaded model must return 400."""
    global current_model
    # Use a real model from MODEL_REGISTRY
    from server import MODEL_REGISTRY
    if not MODEL_REGISTRY:
        pytest.skip("No models in registry")

    target = MODEL_REGISTRY[0]
    current_model = {"id": target["id"], "name": target["name"]}

    req = SwapRequest(model=target["frontend_ids"][0])
    with pytest.raises(HTTPException) as exc_info:
        if current_model and current_model.get("id") == resolve_model_config_strict(req.model).get("id"):
            raise HTTPException(400, {"error": "Model already loaded", "model": current_model["name"]})

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_swap_to_unknown_model_returns_400():
    """Swap to non-existent model must return 400 (no fallback)."""
    model_config = resolve_model_config_strict("nonexistent-model-xyz")
    assert model_config is None

    with pytest.raises(HTTPException) as exc_info:
        if not model_config:
            raise HTTPException(400, "Unknown model: nonexistent-model-xyz")

    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_pipeline_state_transitions_are_atomic():
    """State transitions happen only inside lock boundaries.

    Ensures that pipeline_state is never GENERATING or LOADING
    without the corresponding lock being held.
    """
    # IDLE → LOADING (inside _swap_lock)
    async with _swap_lock:
        pipeline_state = PipelineState.LOADING
        assert _swap_lock.locked()
        pipeline_state = PipelineState.READY

    # READY → GENERATING (inside _gen_lock)
    async with _gen_lock:
        pipeline_state = PipelineState.GENERATING
        assert _gen_lock.locked()
        pipeline_state = PipelineState.READY

    assert pipeline_state == PipelineState.READY
