from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    """
    Clase base declarativa para todos los modelos de SQLAlchemy.
    Soporta tipado estricto y anotaciones para SQLAlchemy 2.0+.
    """
    pass
