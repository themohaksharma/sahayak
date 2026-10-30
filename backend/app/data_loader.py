"""Load scheme records from the curated JSON dataset."""

import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


SCHEMES_PATH = Path(__file__).parent / "data" / "schemes.json"


def load_schemes() -> list[dict[str, Any]]:
    """Return reviewed scheme records after checking required source fields."""
    with SCHEMES_PATH.open(encoding="utf-8") as file:
        data = json.load(file)

    schemes = data.get("schemes")
    if not isinstance(schemes, list):
        raise ValueError("schemes.json must contain a 'schemes' array")

    required_fields = {
        "id",
        "name",
        "overview",
        "benefit_summary",
        "required_documents",
        "verification_status",
        "eligibility_summary",
        "official_sources",
    }
    seen_ids: set[str] = set()
    for index, scheme in enumerate(schemes):
        if not isinstance(scheme, dict):
            raise ValueError(f"schemes[{index}] must be an object")
        missing_fields = required_fields.difference(scheme)
        if missing_fields:
            missing = ", ".join(sorted(missing_fields))
            raise ValueError(f"schemes[{index}] is missing required fields: {missing}")
        if not isinstance(scheme["id"], str) or scheme["id"] in seen_ids:
            raise ValueError(f"schemes[{index}] must have a unique string id")
        seen_ids.add(scheme["id"])
        sources = scheme["official_sources"]
        if not isinstance(sources, list) or not sources:
            raise ValueError(f"schemes[{index}] must include at least one official source")
        for source in sources:
            source_url = source.get("url", "") if isinstance(source, dict) else ""
            hostname = urlparse(source_url).hostname or ""
            if not source_url.startswith("https://") or not hostname.endswith(".gov.in"):
                raise ValueError(f"schemes[{index}] contains a source outside an HTTPS .gov.in domain")

    return schemes
