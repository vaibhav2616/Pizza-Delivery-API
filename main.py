from fastapi import FastAPI
from order_route import order_router
from auth_route import auth_router

app = FastAPI()
app.include_router(order_router)
app.include_router(auth_router)