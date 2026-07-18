from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from app.middleware.auth import require_roles
from app.schemas.knowledge_document import KnowledgeDocumentResponse
from app.services import knowledge_document_service, knowledge_stats_service

router = APIRouter(prefix="/kb-admin", tags=["Knowledge Base Manager"])

MANAGE_ROLES = ("admin", "manager")


@router.get("/documents", response_model=list[KnowledgeDocumentResponse])
def list_documents(
    category: str | None = Query(None),
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    return knowledge_document_service.list_documents(category)


@router.post("/documents", response_model=KnowledgeDocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...),
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    return await knowledge_document_service.upload_document(file, category, current_user)


@router.get("/documents/{document_id}/file")
def get_document_file(
    document_id: int,
    download: bool = Query(False),
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    document, path = knowledge_document_service.get_document_path(document_id)
    media_type = knowledge_document_service.MEDIA_TYPES.get(
        document["file_type"], "application/octet-stream"
    )

    return FileResponse(
        path,
        media_type=media_type,
        filename=document["filename"] if download else None,
        content_disposition_type="attachment" if download else "inline",
    )


@router.get("/documents/{document_id}/preview-text")
def preview_document_text(
    document_id: int,
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    text = knowledge_document_service.extract_preview_text(document_id)
    return JSONResponse({"text": text})


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    return knowledge_document_service.delete_document(document_id, current_user)


@router.get("/stats")
def get_stats(
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    return knowledge_stats_service.get_stats()


@router.post("/rebuild")
def rebuild(
    current_user=Depends(require_roles(*MANAGE_ROLES)),
):
    return knowledge_stats_service.rebuild_knowledge_base()
