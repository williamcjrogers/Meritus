from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path

import pytest
from odf.opendocument import OpenDocumentSpreadsheet
from odf.table import Table, TableCell, TableRow
from odf.text import P
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DecodedStreamObject, DictionaryObject, NameObject

from meritus.sources.documents import (
    FileSlidingWindowBudget,
    discover_official_attachments,
    pdf_pages,
)
from meritus.sources.government import (
    parse_debarment_pdf,
    parse_debarment_text,
    parse_gateway_pdf,
    parse_gateway_text,
    parse_ras_html,
    parse_remediation_ods,
)
from meritus.sources.registry import get_adapter


def test_bsr_aggregate_has_no_project_delay():
    docs = parse_gateway_text(
        "New build\nMedian processing time: 22 weeks",
        "https://www.gov.uk/example",
        "2026-08-31",
    )
    assert docs
    assert not any(
        observation.kind == "gateway_project_delay"
        for document in docs
        for observation in document.observations
    )
    assert docs[0].observations[0].kind == "gateway_metric"
    assert docs[0].observations[0].value == 22


def test_gateway_current_table_value_is_not_replaced_by_historical_narrative():
    text = """Gateway 2: Headline numbers - new build
    At that point, median approval time was 43 weeks.
    Now median approval time is 22 weeks.
    New HRBs and conversions
    Approval rate
    92%
    Median approval time
    22 weeks
    """
    docs = parse_gateway_text(text, "https://www.gov.uk/example.pdf", "2026-08-31", page=3)
    metrics = {item.attributes["metric"]: item.value for item in docs[0].observations}
    assert metrics["median_approval_time"] == 22


def test_gateway_category_headings_split_across_pdf_lines_stay_separate():
    text = """New HRBs and
    conversions
    Median approval time
    22 weeks
    External
    remediations
    Median approval time
    33 weeks
    """
    docs = parse_gateway_text(text, "https://www.gov.uk/example.pdf", "2026-08-31", page=3)
    values = {document.payload["category"]: document.observations[0].value for document in docs}
    assert values == {"new_hrbs_and_conversions": 22, "external_remediation": 33}


def test_gateway_footnoted_not_applicable_is_not_parsed_as_seven():
    docs = parse_gateway_text(
        "NHS internal works (category A and B)\nUnits approved\nN/A7",
        "https://www.gov.uk/example.pdf",
        "2026-08-31",
        page=4,
    )
    observation = docs[0].observations[0]
    assert observation.value is None
    assert observation.attributes["value_status"] == "not_applicable"


def test_gateway_supported_time_metric_has_weeks_unit_without_cell_suffix():
    docs = parse_gateway_text(
        "New HRBs and conversions\nMedian weeks to close\n7",
        "https://www.gov.uk/example.pdf",
        "2026-08-31",
        page=20,
    )
    observation = docs[0].observations[0]
    assert observation.value == 7
    assert observation.unit == "weeks"


def test_retained_gateway_page_six_preserves_complex_case_category():
    page = pdf_pages(Path("tests/fixtures/government/gateway.pdf").read_bytes())[5]
    docs = parse_gateway_text(
        page,
        "https://assets.publishing.service.gov.uk/gateway.pdf",
        "2026-08-31",
        page=6,
    )
    by_category = {document.payload["category"]: document for document in docs}
    complex_case = by_category["new_hrbs_and_conversions_complex_cases"]
    assert {
        observation.attributes["metric"]: observation.value
        for observation in complex_case.observations
    } == {"in_progress": 33, "median_approval_time": 33}
    assert all(observation.unit == "weeks" for observation in complex_case.observations[1:])


def test_gateway_publication_date_stays_distinct_from_data_date(monkeypatch):
    monkeypatch.setattr(
        "meritus.sources.government.pdf_pages",
        lambda _: [
            "Building control data as of 31 August 2026",
            "New build\nMedian processing time: 22 weeks",
        ],
    )
    docs = parse_gateway_pdf(
        b"pdf fixture",
        "https://assets.publishing.service.gov.uk/gateway.pdf",
        "4 September 2026",
    )
    assert docs[0].published_at.date().isoformat() == "2026-09-04"
    assert docs[0].observations[0].period_end.date().isoformat() == "2026-08-31"


def test_ras_membership_is_context_and_absence_is_not_an_adverse_signal():
    html = """
    <html><head><meta name="govuk:public-updated-at" content="2026-08-20"></head><body>
    <h1>Responsible Actors Scheme members</h1>
    <ul><li>Synthetic Homes Limited</li><li>Example Developments plc</li></ul>
    </body></html>
    """
    docs = parse_ras_html(html, "https://www.gov.uk/example", "ras_members")
    assert len(docs) == 2
    assert {item.kind for doc in docs for item in doc.observations} == {"programme_context"}
    assert not any("adverse" in item.kind for doc in docs for item in doc.observations)


def test_ras_ignores_publisher_navigation_and_empty_prohibition_register():
    html = """
    <main><div class="publication-external"><ul class="organisation-logos">
      <li>Ministry of Housing, Communities & Local Government</li>
    </ul></div></main>
    """
    assert parse_ras_html(html, "https://www.gov.uk/example", "ras_prohibitions") == []


def test_retained_official_debarment_pdf_has_a_validated_empty_table():
    assert (
        parse_debarment_pdf(
            Path("tests/fixtures/government/debarment.pdf").read_bytes(),
            "https://assets.publishing.service.gov.uk/debarment.pdf",
            "17 November 2025",
        )
        == []
    )


def test_conditional_blank_narrative_without_a_table_is_not_an_empty_register():
    with pytest.raises(ValueError, match="Debarment"):
        parse_debarment_text(
            "Until a ministerial decision is made to add a supplier, the list will remain blank.",
            "https://assets.publishing.service.gov.uk/debarment.pdf",
            "2026-09-01",
        )


@pytest.mark.parametrize(
    "text",
    [
        "Supplier Name Ground Status Expiry\nExample Ltd exclusion active 31 December 2026",
        "Supplier|Ground|Status|Expiry\nExample Ltd|misconduct|active",
        "Supplier|Ground|Status|Expiry\nExample Ltd||active|31 December 2026",
    ],
)
def test_malformed_debarment_table_is_not_treated_as_an_empty_list(text):
    with pytest.raises(ValueError, match="Debarment"):
        parse_debarment_text(
            text,
            "https://assets.publishing.service.gov.uk/debarment.pdf",
            "2026-09-01",
        )


def test_debarment_without_valid_expiry_remains_pending_with_warning():
    docs = parse_debarment_text(
        "Supplier|Company Number|Ground|Status|Expiry\n"
        "Example Ltd|08834019|misconduct|active|not-a-date",
        "https://assets.publishing.service.gov.uk/debarment.pdf",
        "2026-09-01",
    )
    assert docs[0].entities[0].verified is True
    assert docs[0].observations[0].state == "pending"
    assert any("expiry" in warning.lower() for warning in docs[0].warnings)


def _debarment_pdf_with_rows(rows: list[list[str]]) -> bytes:
    reader = PdfReader(BytesIO(Path("tests/fixtures/government/debarment.pdf").read_bytes()))
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    page = writer.pages[0]
    resources = page["/Resources"].get_object()
    fonts = resources.get("/Font")
    if fonts is None:
        fonts = DictionaryObject()
        resources[NameObject("/Font")] = fonts
    else:
        fonts = fonts.get_object()
    fonts[NameObject("/MeritusTestFont")] = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    column_x = [34.9, 94.9, 224.7, 328.2, 410.7, 497.0, 618.5, 699.5]
    commands = []
    for row_index, row in enumerate(rows):
        y = 231.0 - row_index * 15.1
        for x, value in zip(column_x, row, strict=True):
            escaped = value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            commands.append(f"BT /MeritusTestFont 3.5 Tf 1 0 0 1 {x} {y} Tm ({escaped}) Tj ET")
    overlay = DecodedStreamObject()
    overlay.set_data("\n".join(commands).encode())
    overlay_reference = writer._add_object(overlay)
    contents = page.get("/Contents")
    if isinstance(contents, ArrayObject):
        contents.append(overlay_reference)
    else:
        page[NameObject("/Contents")] = ArrayObject([contents, overlay_reference])
    stream = BytesIO()
    writer.write(stream)
    return stream.getvalue()


def test_populated_official_debarment_layout_preserves_cells_and_namespaces():
    rows = [
        [
            "Synthetic Company Ltd",
            "GB-PPON-ABCD-1234-EFGH",
            "Company: 08834019",
            "Schedule 6 fraud",
            "Mandatory",
            "",
            "31 December 2027",
            "https://www.gov.uk/drs/company",
        ],
        [
            "Synthetic Charity",
            "GB-PPON-IJKL-5678-MNOP",
            "Charity: 1234567",
            "Schedule 7 misconduct",
            "Discretionary",
            "",
            "1 January 2028",
            "https://www.gov.uk/drs/charity",
        ],
        [
            "Synthetic PPON Supplier",
            "GB-PPON-QRST-9012-UVWX",
            "N/A",
            "Schedule 6 national security",
            "Mandatory",
            "Defence contracts",
            "2 February 2028",
            "https://www.gov.uk/drs/ppon",
        ],
    ]
    docs = parse_debarment_pdf(
        _debarment_pdf_with_rows(rows),
        "https://assets.publishing.service.gov.uk/debarment.pdf",
        "17 November 2025",
    )

    assert [document.entities[0].key for document in docs] == [
        "GB-COH:08834019",
        "GB-CHC:1234567",
        "GB-PPON:QRST-9012-UVWX",
    ]
    company = docs[0]
    assert company.payload["row"] == {
        "supplier": "Synthetic Company Ltd",
        "ppon": "GB-PPON-ABCD-1234-EFGH",
        "registration": "Company: 08834019",
        "ground": "Schedule 6 fraud",
        "ground_type": "mandatory",
        "national_security_scope": "",
        "expiry": "31 December 2027",
        "report": "https://www.gov.uk/drs/company",
    }
    observation = company.observations[0]
    assert observation.state == "verified"
    assert observation.evidence_pointer == "pdf:p1:table:debarment:row:1"
    assert observation.attributes["ground_type"] == "mandatory"
    assert observation.attributes["report_reference"] == "https://www.gov.uk/drs/company"


def test_populated_official_debarment_layout_fails_closed_on_partial_row():
    data = _debarment_pdf_with_rows([["Synthetic Supplier", "", "", "", "Mandatory", "", "", ""]])
    with pytest.raises(ValueError, match="row 1"):
        parse_debarment_pdf(
            data,
            "https://assets.publishing.service.gov.uk/debarment.pdf",
            "17 November 2025",
        )


def _cell(value, value_type="string"):
    cell = TableCell(valuetype=value_type)
    cell.addElement(P(text=str(value)))
    return cell


def _remediation_workbook():
    document = OpenDocumentSpreadsheet()
    table = Table(name="Developer_3")
    for values in [
        [
            "Developer by developer breakdown of buildings covered by the developer remediation "
            "contract, England, 30 April 2026"
        ],
        [],
        ["All figures are as of 30 April 2026"],
        [],
        ["Developer", "Buildings covered", "Buildings without a determination"],
        ["Total (all developers)", "16", "0"],
        ["Suppressed Homes Limited", "-", "-"],
        ["Zero Homes Limited", "5", "0"],
    ]:
        row = TableRow()
        for value in values:
            row.addElement(_cell(value))
        table.addElement(row)
    document.spreadsheet.addElement(table)
    stream = BytesIO()
    document.save(stream)
    return stream.getvalue()


def _workbook_with_trailing_repeated_empty_rows():
    document = OpenDocumentSpreadsheet()
    table = Table(name="Developer_3")
    for values in [
        ["Developer breakdown, England, 30 April 2026"],
        [],
        ["All figures are as of 30 April 2026"],
        [],
        ["Developer", "Buildings covered"],
        ["Example Homes Limited", "1"],
    ]:
        row = TableRow()
        for value in values:
            row.addElement(_cell(value))
        table.addElement(row)
    table.addElement(TableRow(numberrowsrepeated=1048570))
    document.spreadsheet.addElement(table)
    stream = BytesIO()
    document.save(stream)
    return stream.getvalue()


def _developer_four_workbook(*, changed_header=False):
    document = OpenDocumentSpreadsheet()
    table = Table(name="Developer_4")
    rows = [
        [
            "Developer by developer breakdown of buildings requiring remediation, England, "
            "30 April 2026"
        ],
        [],
        ["All figures are as of 30 April 2026"],
        [],
        ["", "", "Remediation Status"],
        ["", "", "Buildings being remediated by the developer directly where remediation has..."],
        [
            "",
            "",
            "…not yet started",
            "",
            "... started or completed",
            "",
            "... started",
            "",
            "...completed, awaiting building control sign-off",
            "",
            "...completed",
        ],
        [
            "Developer [Note 25, Note 29]",
            "Number of buildings found to require remediation, which will be remediated by the "
            "developer directly [Note 30]",
            "Percentage" if changed_header else "Number",
            "Percentage",
            "Number",
            "Percentage",
            "Number",
            "Percentage",
            "Number",
            "Percentage",
            "Number",
            "Percentage",
        ],
        [
            "Total (all developers)",
            "10",
            "4",
            "40%",
            "6",
            "60%",
            "3",
            "30%",
            "1",
            "10%",
            "2",
            "20%",
        ],
    ]
    for values in rows:
        row = TableRow()
        for value in values:
            row.addElement(_cell(value))
        table.addElement(row)
    document.spreadsheet.addElement(table)
    stream = BytesIO()
    document.save(stream)
    return stream.getvalue()


def test_ods_suppression_zero_and_table_date_are_distinct():
    docs = parse_remediation_ods(
        _remediation_workbook(),
        "https://assets.publishing.service.gov.uk/remediation.ods",
        datetime(2026, 7, 31, tzinfo=UTC),
    )
    suppressed = next(doc for doc in docs if doc.title == "Suppressed Homes Limited")
    assert suppressed.observations[0].value is None
    assert suppressed.observations[0].attributes["value_status"] == "suppressed"
    assert suppressed.observations[0].period_end.date().isoformat() == "2026-04-30"
    assert suppressed.published_at.date().isoformat() == "2026-07-31"
    zero = next(doc for doc in docs if doc.title == "Zero Homes Limited")
    assert any(item.value == 0 for item in zero.observations)
    assert any(item.attributes["value_status"] == "reported" for item in zero.observations)
    assert all("Developer_3!" in item.evidence_pointer for item in zero.observations)


def test_ods_ignores_trailing_repeated_empty_rows():
    docs = parse_remediation_ods(
        _workbook_with_trailing_repeated_empty_rows(),
        "https://assets.publishing.service.gov.uk/remediation.ods",
        "31 July 2026",
    )
    assert [document.title for document in docs] == ["Example Homes Limited"]


def test_developer_four_validates_observed_multirow_headers_before_mapping():
    docs = parse_remediation_ods(
        _developer_four_workbook(),
        "https://assets.publishing.service.gov.uk/remediation.ods",
        "31 July 2026",
    )
    total = next(document for document in docs if document.title == "Total (all developers)")
    assert [observation.value for observation in total.observations] == [
        10,
        4,
        40,
        6,
        60,
        3,
        30,
        1,
        10,
        2,
        20,
    ]

    with pytest.raises(ValueError, match="Developer_4 header"):
        parse_remediation_ods(
            _developer_four_workbook(changed_header=True),
            "https://assets.publishing.service.gov.uk/remediation.ods",
            "31 July 2026",
        )


def test_discovery_accepts_only_official_https_pdf_and_ods_links():
    html = """
    <a href="https://assets.publishing.service.gov.uk/report.pdf">PDF</a>
    <a href="/government/uploads/remediation.ods">ODS</a>
    <a href="http://assets.publishing.service.gov.uk/insecure.pdf">insecure</a>
    <a href="https://example.com/foreign.pdf">foreign</a>
    """
    links = discover_official_attachments(html, "https://www.gov.uk/publication/example")
    assert links == [
        "https://assets.publishing.service.gov.uk/report.pdf",
        "https://www.gov.uk/government/uploads/remediation.ods",
    ]


def test_discovery_can_select_the_named_debarment_list_not_other_pdfs():
    html = """
    <a href="https://assets.publishing.service.gov.uk/scope.pdf">Scope and Remit</a>
    <a href="https://assets.publishing.service.gov.uk/list.pdf">Debarment List</a>
    """
    links = discover_official_attachments(
        html,
        "https://www.gov.uk/guidance/debarment-review-service-drs",
        link_text="Debarment List",
    )
    assert links == ["https://assets.publishing.service.gov.uk/list.pdf"]


def test_file_rate_budget_rejects_request_beyond_shared_window(tmp_path):
    clock = iter([100.0, 100.0, 100.0])
    budget = FileSlidingWindowBudget(
        tmp_path / "gazette.json", limit=2, window_seconds=10, clock=lambda: next(clock)
    )
    assert budget.acquire() is None
    assert budget.acquire() is None
    assert budget.acquire() == 10


@pytest.mark.parametrize(
    "source_id",
    [
        "companies_house",
        "gazette",
        "bsr_gateway",
        "ras_members",
        "ras_prohibitions",
        "developer_remediation",
        "debarment",
    ],
)
def test_statutory_sources_are_registered(source_id):
    assert callable(get_adapter(source_id).fetch)


def test_debarment_report_shared_by_suppliers_has_independent_stable_records():
    text = (
        "Supplier|Company number|Ground|Status|Expiry|Report\n"
        "Synthetic A|09999999|Ground A|Active|2027-09-12|R-1\n"
        "Synthetic B|08888888|Ground A|Active|2027-09-12|R-1"
    )
    docs = parse_debarment_text(
        text,
        "https://assets.publishing.service.gov.uk/debarment.pdf",
        datetime(2026, 9, 12, tzinfo=UTC),
    )
    assert len({doc.external_id for doc in docs}) == 2
    assert len({doc.observations[0].event_key for doc in docs}) == 2
    revised = parse_debarment_text(
        text.replace("2027-09-12", "2028-09-12"),
        "https://assets.publishing.service.gov.uk/debarment.pdf",
        datetime(2026, 9, 12, tzinfo=UTC),
    )
    assert [doc.external_id for doc in revised] == [doc.external_id for doc in docs]


def test_debarment_invalid_company_number_is_retained_for_identity_review():
    docs = parse_debarment_text(
        "Supplier|Company number|Ground|Status|Expiry|Report\n"
        "Synthetic overseas supplier|N/A|Ground A|Active|2027-09-12|R-1",
        "https://assets.publishing.service.gov.uk/debarment.pdf",
        datetime(2026, 9, 12, tzinfo=UTC),
    )
    assert len(docs) == 1 and docs[0].entities[0].verified is False
    assert docs[0].observations[0].state == "pending"


@pytest.mark.parametrize("source_id", ["ras_members", "ras_prohibitions"])
def test_empty_ras_extraction_without_publisher_statement_fails(source_id):
    import httpx

    from meritus.sources.http import FetchError

    html = (
        '<main><div class="govspeak"><p>Register content temporarily unavailable.</p></div></main>'
    )
    with (
        httpx.Client(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, text=html))
        ) as client,
        pytest.raises(FetchError, match="empty"),
    ):
        get_adapter(source_id).fetch({"config": {}}, client, datetime.now(UTC))


def test_explicit_ras_prohibition_empty_statement_is_verified():
    import httpx

    html = (
        '<main><div class="govspeak"><p>There are currently no persons to whom '
        "prohibitions apply under the Building Safety (Responsible Actors Scheme and "
        "Prohibitions) Regulations 2023.</p></div></main>"
    )
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, text=html))
    ) as client:
        result = get_adapter("ras_prohibitions").fetch({"config": {}}, client, datetime.now(UTC))
    assert result.complete is True and result.documents == []
    assert "publisher explicitly" in result.warnings[0].lower()
