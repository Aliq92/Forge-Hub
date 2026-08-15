from ant_colony.providers.base import VerificationRequest
from ant_colony.research.scenario import CONTRADICTORY_CLAIM


def configured_contradiction_request() -> VerificationRequest:
    return VerificationRequest(
        verification_task_id="TASK-0100",
        target_task_id="TASK-0002",
        topic_key="central-control",
        result_content=CONTRADICTORY_CLAIM,
    )

