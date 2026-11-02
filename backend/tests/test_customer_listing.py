from app.customers.service import escape_like


def test_search_escapes_sql_like_metacharacters() -> None:
    assert escape_like(r"50%_off\today") == r"50\%\_off\\today"
