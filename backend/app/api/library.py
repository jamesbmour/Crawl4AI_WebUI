"""Schema library + config profiles CRUD."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..core import storage
from ..models.schemas import ProfileIn, SavedSchemaIn

router = APIRouter()


# --- Schemas ---------------------------------------------------------------

@router.get("/schemas")
async def list_schemas():
    return await storage.list_schemas()


@router.post("/schemas")
async def create_schema(body: SavedSchemaIn):
    schema_id = await storage.create_schema(body.name, body.description, body.kind, body.payload)
    return {"id": schema_id}


@router.get("/schemas/{schema_id}")
async def get_schema(schema_id: int):
    schema = await storage.get_schema(schema_id)
    if schema is None:
        raise HTTPException(404, "Schema not found")
    return schema


@router.put("/schemas/{schema_id}")
async def update_schema(schema_id: int, body: SavedSchemaIn):
    if await storage.get_schema(schema_id) is None:
        raise HTTPException(404, "Schema not found")
    await storage.update_schema(schema_id, body.name, body.description, body.kind, body.payload)
    return {"ok": True}


@router.delete("/schemas/{schema_id}")
async def delete_schema(schema_id: int):
    await storage.delete_schema(schema_id)
    return {"ok": True}


# --- Profiles ----------------------------------------------------------------

@router.get("/profiles")
async def list_profiles():
    return await storage.list_profiles()


@router.post("/profiles")
async def create_profile(body: ProfileIn):
    profile_id = await storage.create_profile(
        body.name, body.description, body.config.model_dump(mode="json", exclude_none=True)
    )
    return {"id": profile_id}


@router.get("/profiles/{profile_id}")
async def get_profile(profile_id: int):
    profile = await storage.get_profile(profile_id)
    if profile is None:
        raise HTTPException(404, "Profile not found")
    return profile


@router.put("/profiles/{profile_id}")
async def update_profile(profile_id: int, body: ProfileIn):
    if await storage.get_profile(profile_id) is None:
        raise HTTPException(404, "Profile not found")
    await storage.update_profile(
        profile_id, body.name, body.description, body.config.model_dump(mode="json", exclude_none=True)
    )
    return {"ok": True}


@router.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: int):
    await storage.delete_profile(profile_id)
    return {"ok": True}
