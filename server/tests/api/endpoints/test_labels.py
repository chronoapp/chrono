import json
from sqlalchemy.orm import Session
from typing import Tuple

from app.api.endpoints.labels import combineLabels
from app.api.endpoints.authentication import getAuthToken
from app.db.models.label import Label
from app.db.models import User


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


def test_getLabels(userSession: Tuple[User, Session], test_client):
    user, session = userSession

    l1 = Label("label-1", "#fff")
    l2 = Label("label-2", "#fff")
    user.labels.append(l1)
    user.labels.append(l2)
    user.labels.reorder()
    session.commit()

    token = getAuthToken(user)
    resp = test_client.get(f'/api/v1/labels/', headers={'Authorization': token})

    labels = resp.json()
    assert labels[0].get('title') == 'label-1'
    assert labels[1].get('title') == 'label-2'


def test_createLabel(userSession: Tuple[User, Session], test_client):
    user, _ = userSession

    labelData = {'title': 'label-1', 'color_hex': '#cccccc'}
    token = getAuthToken(user)
    resp = test_client.post(
        f'/api/v1/labels/', headers={'Authorization': token}, data=json.dumps(labelData)
    )

    label = resp.json()
    assert label.get('title') == 'label-1'
    assert label.get('position') == 0

    # Label 2
    labelData = {'title': 'label-2', 'color_hex': '#ffffff'}
    token = getAuthToken(user)
    resp = test_client.post(
        f'/api/v1/labels/', headers={'Authorization': token}, data=json.dumps(labelData)
    )

    label = resp.json()
    assert label.get('position') == 1


def test_deleteLabel(userSession: Tuple[User, Session], test_client):
    user, session = userSession

    l1 = Label("label-1", "#ffffff")
    l2 = Label("label-2", "#ffffff")
    l3 = Label("label-3", "#ffffff")
    user.labels.append(l1)
    user.labels.append(l2)
    user.labels.append(l3)
    user.labels.reorder()
    session.commit()

    token = getAuthToken(user)
    resp = test_client.delete(f'/api/v1/labels/{l2.id}', headers={'Authorization': token})

    assert resp.ok
    assert len(user.labels) == 2

    assert user.labels[0].position == 0
    assert user.labels[1].position == 1
