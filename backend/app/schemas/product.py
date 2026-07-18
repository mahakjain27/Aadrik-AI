from pydantic import BaseModel


class Product(BaseModel):
    id: str
    category: str
    subcategory: str | None = None
    name: str
    brand: str | None = None
    grade: str | list[str] | None = None
    sizes: list[str] = []
    packing: list[str] = []
    applications: list[str] = []


class ProductCatalog(BaseModel):
    categories: list[str]
    brands: list[str]
    products: list[Product]


class CreateProductRequest(BaseModel):
    name: str
    brand: str | None = None
    category: str | None = None
    subcategory: str | None = None
    grade: str | None = None
    sizes: list[str] = []
    packaging: list[str] = []
    applications: list[str] = []
    mrp: float | None = None
    selling_price: float | None = None
    gst_percent: float = 18.0
    stock_status: str = "In Stock"
    description: str | None = None


class UpdateProductRequest(CreateProductRequest):
    is_active: bool = True


class ProductRecord(BaseModel):
    id: int
    slug: str
    name: str
    brand: str | None = None
    category: str | None = None
    subcategory: str | None = None
    grade: str | None = None
    sizes: list[str] = []
    packaging: list[str] = []
    applications: list[str] = []
    mrp: float | None = None
    selling_price: float | None = None
    gst_percent: float
    stock_status: str
    description: str | None = None
    is_active: bool
    created_at: str
    updated_at: str
