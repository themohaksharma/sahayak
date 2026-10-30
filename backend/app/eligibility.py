"""Deterministic, preliminary scheme screening rules."""

from typing import Any

from app.data_loader import load_schemes


STATUS_ORDER = {
    "potentially_eligible": 0,
    "needs_verification": 1,
    "ineligible": 2,
}


def _result(
    scheme: dict[str, Any],
    status: str,
    reasons: list[dict[str, str]],
    conditions_to_verify: list[dict[str, str]],
) -> dict[str, Any]:
    return {
        **scheme,
        "eligibility_status": status,
        "reasons": reasons,
        "conditions_to_verify": conditions_to_verify,
    }


def _text(hi: str, en: str) -> dict[str, str]:
    return {"hi": hi, "en": en}


def evaluate_eligibility(answers: dict[str, str | None]) -> dict[str, Any]:
    """Return at most three scheme assessments without storing the answers."""
    schemes = {scheme["id"]: scheme for scheme in load_schemes()}
    farming = answers.get("farming", "unsure")
    farmer_type = answers.get("farmer_type", "unsure")
    land_records = answers.get("land_records", "unsure")
    state = (answers.get("state") or "").strip()
    crop_season = (answers.get("crop_season") or "").strip()
    notification = answers.get("notification", "unsure")
    pmfby_checks: list[dict[str, str]] = []
    if state:
        pmfby_checks.append(_text(
            f"{state} की मौजूदा राज्य अधिसूचना में फसल, क्षेत्र और मौसम जाँचें।",
            f"Check the crop, area and season in the current {state} State notification.",
        ))
    else:
        pmfby_checks.append(_text(
            "राज्य का नाम नहीं मिला; मौजूदा राज्य अधिसूचना में फसल, क्षेत्र और मौसम जाँचें।",
            "A state was not provided; check the current State notification for the crop, area and season.",
        ))
    if crop_season:
        pmfby_checks.append(_text(
            f"आपके बताए फसल/मौसम ({crop_season}) की अधिसूचना जाँचें।",
            f"Check the notification for the crop and season you gave ({crop_season}).",
        ))
    else:
        pmfby_checks.append(_text(
            "फसल और मौसम की जानकारी देकर उनकी अधिसूचना जाँचें।",
            "Provide the crop and season so their notification can be checked.",
        ))
    pmfby_checks.append(_text(
        "अपनी खेती की व्यवस्था के लिए बीमा योग्य हित का प्रमाण जाँचें।",
        "Confirm the required proof of insurable interest for your farming arrangement.",
    ))

    results: list[dict[str, Any]] = []

    pm_kisan = schemes["pm_kisan"]
    if farming == "no":
        results.append(_result(
            pm_kisan,
            "ineligible",
            [_text("योजना की जाँची गई जानकारी पात्र किसान परिवारों के लिए है।", "The reviewed PM-KISAN source describes support for eligible farmer families.")],
            [],
        ))
    elif land_records == "no":
        results.append(_result(
            pm_kisan,
            "ineligible",
            [_text("आपने बताया कि आपके, पति/पत्नी या नाबालिग बच्चे के नाम खेती की जमीन दर्ज नहीं है।", "You said no farm land is recorded in your, your spouse's or a minor child's name.")],
            [],
        ))
    elif farming == "yes" and land_records == "yes":
        results.append(_result(
            pm_kisan,
            "potentially_eligible",
            [_text("आपने बताया कि आप खेती करते हैं और आपके, पति/पत्नी या नाबालिग बच्चे के नाम जमीन दर्ज है।", "You said you farm and that land is recorded in your, your spouse's or a minor child's name.")],
            [
                _text("राज्य या केंद्र शासित प्रदेश को भूमि रिकॉर्ड देखकर पात्र परिवार की पुष्टि करनी होगी।", "The State or UT must confirm the land record and identify the eligible farmer family."),
                _text("PM-KISAN पोर्टल पर मौजूदा अपवर्जन शर्तें जाँचें।", "Check the current exclusion categories on the official PM-KISAN portal."),
            ],
        ))
    else:
        results.append(_result(
            pm_kisan,
            "needs_verification",
            [_text("आपके जवाबों से परिवार की भूमि-धारक किसान वाली शर्त की पुष्टि नहीं हुई।", "Your answers do not yet confirm the landholding farmer-family condition.")],
            [_text("राज्य या केंद्र शासित प्रदेश से परिवार का भूमि रिकॉर्ड और मौजूदा अपवर्जन शर्तें जाँचें।", "Confirm the family land record and current exclusion conditions through the State or UT.")],
        ))

    kcc = schemes["kisan_credit_card"]
    if farming == "no" or farmer_type == "other":
        results.append(_result(
            kcc,
            "ineligible",
            [_text("आपके जवाब योजना में दी गई किसान या किसान समूह की श्रेणियों से मेल नहीं खाते।", "Your answers do not match the farmer or farmer-group categories listed on the scheme page.")],
            [],
        ))
    elif farmer_type in {"owner_cultivator", "tenant_sharecropper", "farmer_group"}:
        results.append(_result(
            kcc,
            "potentially_eligible",
            [_text("योजना के पृष्ठ में आपके चुने हुए खेती के तरीके का ज़िक्र है।", "The scheme page includes the farming role you selected.")],
            [_text("बैंक को आवेदन, फसल योजना और ऋण की ज़रूरत की जाँच करनी होगी।", "A participating bank must review your application, crop plan and credit requirements.")],
        ))
    else:
        results.append(_result(
            kcc,
            "needs_verification",
            [_text("आपके जवाबों से किसान या समूह की श्रेणी स्पष्ट नहीं हुई।", "The farmer or group category is not clear from your answers.")],
            [_text("भाग लेने वाले बैंक से पूछें कि आपकी खेती की व्यवस्था आवेदन कर सकती है या नहीं।", "Ask a participating bank whether your farming arrangement can apply.")],
        ))

    pmfby = schemes["pmfby"]
    recognized_farmer_role = farmer_type in {
        "owner_cultivator",
        "tenant_sharecropper",
    }
    if farming == "no" or farmer_type == "other" or notification == "no":
        results.append(_result(
            pmfby,
            "ineligible",
            [_text("आपके जवाबों के अनुसार किसान, फसल या अधिसूचित क्षेत्र की ज़रूरी शर्त पूरी नहीं है।", "Your answers indicate that a required farmer, crop or notified-area condition is not met.")],
            [],
        ))
    elif farming == "yes" and recognized_farmer_role and notification == "yes" and crop_season:
        results.append(_result(
            pmfby,
            "needs_verification",
            [_text("आपके जवाब किसान और अधिसूचित फसल के बारे में आपकी जानकारी से मेल खाते हैं।", "Your answers are consistent with a farmer growing a crop that you believe is notified.")],
            pmfby_checks,
        ))
    else:
        results.append(_result(
            pmfby,
            "needs_verification",
            [_text("PMFBY का कवरेज किसान, फसल और मौजूदा मौसम में अधिसूचित क्षेत्र पर निर्भर करता है।", "PMFBY coverage depends on the farmer, crop and area notified for the current season.")],
            pmfby_checks,
        ))

    results.sort(key=lambda item: STATUS_ORDER[item["eligibility_status"]])
    return {
        "results": results[:3],
        "notice": _text(
            "ये तीन जाँची गई किसान योजनाओं की शुरुआती जानकारी है। यह आवेदन का फैसला या सरकारी मंज़ूरी नहीं है। API जवाब सहेजता नहीं है।",
            "These are preliminary matches for three reviewed farmer schemes. They are not an application decision or official approval. The API does not save answers.",
        ),
    }
