import uuid

from app.api.endpoints.labels import combineLabels
from app.api.endpoints.authentication.token_utils import getAuthToken

from app.db.models.label import Label
from app.db.repos.user_repo import UserRepository


def test_combineLabels(session):
    l1 = Label("label-1", "#fff")
    l1.id = uuid.uuid4()
    session.commit()

    l2 = Label("label-2", "#fff")
    l2.id = uuid.uuid4()
    l2.parent_id = l1.id

    labels = [l1, l2]
    combined = combineLabels(labels)

    assert len(combined) == 1
    assert combined[0].id == l2.id


def test_getLabels(user, session, test_client):
    l1 = Label("label-1", "#fff")
    l2 = Label("label-2", "#fff")
    user.labels.append(l1)
    user.labels.append(l2)
    session.commit()

    token = getAuthToken(user)
    resp = test_client.get('/api/v1/labels/', headers={'Authorization': token})

    labels = resp.json()
    assert labels[0].get('title') == 'label-1'
    assert labels[1].get('title') == 'label-2'


def test_createLabel(user, test_client):
    labelData = {'title': 'label-1', 'color_hex': '#cccccc'}
    token = getAuthToken(user)
    resp = test_client.post(f'/api/v1/labels/', headers={'Authorization': token}, json=labelData)

    label = resp.json()
    assert label.get('title') == 'label-1'
    assert label.get('position') == 0

    # Label 2
    labelData = {'title': 'label-2', 'color_hex': '#ffffff'}
    token = getAuthToken(user)
    resp = test_client.post(f'/api/v1/labels/', headers={'Authorization': token}, json=labelData)

    label = resp.json()
    assert label.get('position') == 1


def test_deleteLabel(user, session, test_client):
    userRepo = UserRepository(session)

    l1 = Label("label-1", "#ffffff")
    l2 = Label("label-2", "#ffffff")
    l3 = Label("label-3", "#ffffff")
    user.labels.append(l1)
    user.labels.append(l2)
    user.labels.append(l3)
    session.commit()

    labels = userRepo.getLabels(user.id)
    assert len(labels) == 3

    token = getAuthToken(user)
    resp = test_client.delete(f'/api/v1/labels/{l2.id}', headers={'Authorization': token})

    assert resp.status_code == 200

    labels = userRepo.getLabels(user.id)

    assert len(labels) == 2

    labelIds = [l.id for l in labels]

    assert l1.id in labelIds
    assert l2.id not in labelIds
    assert l3.id in labelIds
