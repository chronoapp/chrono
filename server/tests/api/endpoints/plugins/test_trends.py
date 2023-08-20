from app.db.models import Label
from app.api.endpoints.plugins.trends import getSubtreeLabelIds


def test_getSubtreeLabelIds(user, session):
    l1 = Label('l1')
    l1_2 = Label('l1_2')
    l1_3 = Label('l1_3')
    l1_3_1 = Label('l1_3_1')
    l2 = Label('l2')

    l1_2.parent = l1
    l1_3.parent = l1
    l1_3_1.parent = l1_3

    user.labels.append(l1)
    user.labels.append(l1_2)
    user.labels.append(l1_3)
    user.labels.append(l1_3_1)
    user.labels.append(l2)
    session.commit()

    assert getSubtreeLabelIds(user, l1_3.id) == [l1_3.id, l1_3_1.id]
    assert set(getSubtreeLabelIds(user, l1.id)) == set([l1.id, l1_2.id, l1_3.id, l1_3_1.id])
    assert getSubtreeLabelIds(user, l2.id) == [l2.id]
