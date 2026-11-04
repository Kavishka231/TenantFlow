from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.customers import router as customers_router
from app.api.routes.deals import router as deals_router
from app.api.routes.expenses import router as expenses_router
from app.api.routes.health import router as health_router
from app.api.routes.invitations import router as invitations_router
from app.api.routes.invoices import router as invoices_router
from app.api.routes.organizations import router as organizations_router
from app.api.routes.team import router as team_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(organizations_router)
api_router.include_router(team_router)
api_router.include_router(invitations_router)
api_router.include_router(customers_router)
api_router.include_router(invoices_router)
api_router.include_router(deals_router)
api_router.include_router(expenses_router)
