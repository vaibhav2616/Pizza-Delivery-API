from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.menu import PizzaMenu

class MenuService:
    @staticmethod
    def get_available_menu(db: Session, category: Optional[str] = None) -> List[PizzaMenu]:
        query = db.query(PizzaMenu).filter(PizzaMenu.is_available == True)
        if category and category.lower() != "all":
            query = query.filter(PizzaMenu.category.ilike(category))
        return query.all()

    @staticmethod
    def get_menu_item_by_name(db: Session, name: str) -> Optional[PizzaMenu]:
        return db.query(PizzaMenu).filter(PizzaMenu.name == name).first()

