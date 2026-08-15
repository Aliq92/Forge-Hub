from datetime import UTC, datetime

from ant_colony.blackboard.board import Blackboard
from ant_colony.blackboard.ids import SequentialIdSource
from ant_colony.blackboard.models import (
    ResultDraft,
    TaskDraft,
    TaskKind,
    TaskStatus,
    VerificationDraft,
    VerificationVerdict,
)
from ant_colony.blackboard.verification import VerificationService
from ant_colony.events.clock import IncrementingClock
from ant_colony.events.journal import EventJournal


def make_board() -> Blackboard:
    clock = IncrementingClock(datetime(2026, 8, 15, tzinfo=UTC))
    ids = SequentialIdSource()
    return Blackboard("RUN-0001", EventJournal(clock, ids), clock, ids)


def completed_task(board: Blackboard, confidence: float = 0.8):
    task = board.create_task(
        TaskDraft(
            "Conflicting finding",
            "A finding that requires review.",
            TaskKind.RESEARCH,
            7,
            frozenset({"analysis"}),
            "SYSTEM",
            confidence=confidence,
            topic_key="conflict",
        )
    )
    board.claim_task(task.id, "ANT-01")
    result = board.add_result(task.id, "ANT-01", ResultDraft("Finding", ("evidence",), confidence, "execute"))
    return board.complete_task(task.id, "ANT-01", result.id)


def test_contradiction_reduces_confidence_and_reopens_target() -> None:
    board = make_board()
    target = completed_task(board)
    check = board.create_verification_task(target.id, "SYSTEM")
    board.claim_task(check.id, "ANT-07")

    record = VerificationService(board).apply(
        VerificationDraft(
            check.id,
            target.id,
            "ANT-07",
            VerificationVerdict.CONTRADICTION,
            -0.35,
            ("Fixture evidence conflicts.",),
            recommend_reopen=True,
        )
    )

    assert record.verdict is VerificationVerdict.CONTRADICTION
    assert board.task(target.id).confidence == 0.45
    assert board.task(target.id).status is TaskStatus.OPEN
    assert board.task(check.id).status is TaskStatus.COMPLETED


def test_agreement_verifies_sufficiently_confident_target() -> None:
    board = make_board()
    target = completed_task(board, confidence=0.7)
    check = board.create_verification_task(target.id, "SYSTEM")
    board.claim_task(check.id, "ANT-08")

    VerificationService(board, verification_threshold=0.75).apply(
        VerificationDraft(
            check.id,
            target.id,
            "ANT-08",
            VerificationVerdict.AGREE,
            0.1,
            ("Independent evidence agrees.",),
        )
    )

    assert board.task(target.id).status is TaskStatus.VERIFIED
    assert board.task(target.id).confidence == 0.8
