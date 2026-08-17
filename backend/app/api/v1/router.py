from fastapi import APIRouter

from app.api.v1 import (
    accounts,
    assistant,
    auth,
    budgets,
    categories,
    reports,
    transactions,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(categories.router)
api_router.include_router(accounts.router)
api_router.include_router(transactions.router)
api_router.include_router(budgets.router)
api_router.include_router(reports.router)
api_router.include_router(assistant.router)
