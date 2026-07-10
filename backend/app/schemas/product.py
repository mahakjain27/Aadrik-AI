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
