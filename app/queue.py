import json
import os

from redis import Redis

QUEUE_NAME = os.getenv("REDIS_QUEUE_NAME", "document_jobs")


def get_redis_client() -> Redis:
    return Redis(
        host=os.getenv("REDIS_HOST", "redis"),
        port=int(os.getenv("REDIS_PORT", "6379")),
        db=int(os.getenv("REDIS_DB", "0")),
        decode_responses=True,
    )


def enqueue_document_job(payload: dict[str, str]) -> None:
    get_redis_client().rpush(QUEUE_NAME, json.dumps(payload))


def dequeue_document_job() -> dict[str, str]:
    _, raw_job = get_redis_client().blpop(QUEUE_NAME)
    return json.loads(raw_job)
