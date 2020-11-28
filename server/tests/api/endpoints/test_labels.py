from app.api.endpoints.labels import combineLabels
from app.db.models.label import Label


def test_combineLabels():
    l1 = Label("label-1", "#fff")
    l1.id = 1

    l2 = Label("label-2", "#fff")
    l2.id = 2
    l2.parent_id = 1

    labels = [l1, l2]
    combined = combineLabels(labels)

    assert len(combined) == 1
    assert combined[0].id == 2
