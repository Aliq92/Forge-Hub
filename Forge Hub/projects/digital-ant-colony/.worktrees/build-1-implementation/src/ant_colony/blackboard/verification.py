"""Independent verification and confidence rules."""

from ant_colony.blackboard.board import Blackboard
from ant_colony.blackboard.models import VerificationDraft, VerificationRecord, VerificationVerdict


class VerificationService:
    def __init__(self, board: Blackboard, verification_threshold: float = 0.75) -> None:
        self._board = board
        self._threshold = verification_threshold

    def apply(self, draft: VerificationDraft) -> VerificationRecord:
        record = self._board.record_verification(draft)
        self._board.complete_verification_task(draft.verification_task_id, draft.verifier_id)
        target = self._board.adjust_confidence(
            draft.target_task_id,
            draft.verifier_id,
            draft.confidence_delta,
        )
        if draft.verdict is VerificationVerdict.AGREE and target.confidence >= self._threshold:
            self._board.verify_task(target.id, draft.verifier_id)
        elif draft.recommend_reopen:
            self._board.reopen_task(
                target.id,
                draft.verifier_id,
                draft.verdict.value,
                increment_attempt=True,
            )
        return record
