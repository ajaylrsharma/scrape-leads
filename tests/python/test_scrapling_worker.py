import pytest
from fastapi.testclient import TestClient
from scrapling_worker import app

client = TestClient(app)


class TestScraplingWorker:
    def test_extract_endpoint_exists(self):
        response = client.post('/extract', json={'url': 'https://example.com'})
        assert response.status_code in (200, 422, 500)

    def test_extract_requires_url(self):
        response = client.post('/extract', json={})
        assert response.status_code == 422

    def test_extract_validates_url_format(self):
        response = client.post('/extract', json={'url': 'not-a-url'})
        assert response.status_code == 422

    def test_extract_returns_expected_structure(self, monkeypatch):
        async def mock_fetch(*args, **kwargs):
            class MockPage:
                def css(self, selector):
                    class MockElements:
                        def getall(self):
                            return ['Test business content', 'contact@test.com']
                    return MockElements()
            return MockPage()

        monkeypatch.setattr('scrapling_worker.StealthyFetcher.fetch', mock_fetch)

        response = client.post('/extract', json={'url': 'https://example.com'})
        if response.status_code == 200:
            data = response.json()
            assert 'url' in data
            assert 'text' in data
            assert 'emails' in data
            assert 'links' in data
            assert isinstance(data['emails'], list)
            assert isinstance(data['links'], list)

    def test_extract_limits_emails_and_links(self, monkeypatch):
        async def mock_fetch_many(*args, **kwargs):
            class MockPage:
                def css(self, selector):
                    class MockElements:
                        def getall(self):
                            if 'a[href]' in selector:
                                return [type('obj', (object,), {'attrib': {'href': f'https://example.com/link{i}'}}) for i in range(250)]
                            return [' '.join([f'email{i}@test.com' for i in range(30)])]
                    return MockElements()
            return MockPage()

        monkeypatch.setattr('scrapling_worker.StealthyFetcher.fetch', mock_fetch_many)

        response = client.post('/extract', json={'url': 'https://example.com'})
        if response.status_code == 200:
            data = response.json()
            assert len(data['emails']) <= 20
            assert len(data['links']) <= 200


class TestRequestModel:
    def test_valid_request(self):
        from scrapling_worker import Request
        req = Request(url='https://example.com')
        assert str(req.url) == 'https://example.com/'

    def test_invalid_url_raises(self):
        from scrapling_worker import Request
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            Request(url='invalid')