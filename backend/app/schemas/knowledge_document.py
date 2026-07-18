from pydantic import BaseModel

CATEGORIES = [
    "Policies",
    "Catalogues",
    "Technical Datasheets",
    "FAQs",
    "Company Information",
    "Other",
]


class KnowledgeDocumentResponse(BaseModel):
    id: int
    filename: str
    file_type: str
    category: str
    file_size: int | None = None
    uploaded_by: int | None = None
    uploaded_by_name: str | None = None
    uploaded_at: str
