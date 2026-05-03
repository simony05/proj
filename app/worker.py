import logging
import os

from .queue import dequeue_document_job
from .rag import process_document
from .workspace import get_document, workspace_path

logger = logging.getLogger("pdf_rag_worker")


def run_worker() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )

    logger.info("Worker started and waiting for Redis jobs")

    while True:
        job = dequeue_document_job()
        workspace_id = job["workspace_id"]
        document_id = job["document_id"]
        ws_dir = workspace_path(workspace_id)
        document = get_document(workspace_id, document_id)

        if document is None:
            logger.warning(
                "Skipping missing document %s in workspace %s",
                document_id,
                workspace_id,
            )
            continue

        document = document.model_copy(update={"file_path": job["file_path"]})

        try:
            logger.info(
                "Processing document %s in workspace %s",
                document.document_id,
                document.workspace_id,
            )
            process_document(ws_dir, document)
            logger.info("Document %s is ready", document.document_id)
        except Exception:
            logger.exception("Failed to process document %s", document.document_id)


if __name__ == "__main__":
    run_worker()
