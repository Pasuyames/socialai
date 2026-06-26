"""
Crawl4AI FastAPI microservice — DataMiner için ücretsiz scraping.

Kurulum:
  pip install crawl4ai fastapi uvicorn

Çalıştırma:
  python crawl4ai_service.py

.env'e ekle:
  CRAWL4AI_URL=http://localhost:8001
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio

app = FastAPI(title="Crawl4AI Service", version="1.0.0")


class CrawlRequest(BaseModel):
    url: str
    limit: int = 5


class PageData(BaseModel):
    url: str
    title: str
    content: str


class CrawlResponse(BaseModel):
    pages: list[PageData]


@app.post("/crawl", response_model=CrawlResponse)
async def crawl(req: CrawlRequest):
    try:
        from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

        config = CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS,
            word_count_threshold=10,
            page_timeout=30000,
        )

        pages: list[PageData] = []

        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=req.url, config=config)

            if result.success:
                pages.append(PageData(
                    url=result.url or req.url,
                    title=result.metadata.get("title", "") if result.metadata else "",
                    content=(result.markdown or "")[:3000],
                ))

        return CrawlResponse(pages=pages)

    except ImportError:
        raise HTTPException(status_code=500, detail="crawl4ai kurulu değil: pip install crawl4ai")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
