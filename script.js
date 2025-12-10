// Escape HTML helper
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m]));
}

async function runSearch() {
  const params = new URLSearchParams(window.location.search);
  const terms = params.get("terms")?.trim();

  if (!terms) {
    document.getElementById('results').innerHTML = `
      <h2>Error</h2>
      <p>Please provide <code>?terms=</code> in the URL, e.g. <code>?terms=cancer</code></p>`;
    return;
  }

  document.getElementById('page-title').textContent = `PubMed Results for: "${terms}"`;

  try {
    // 1️⃣ SEARCH PUBMED
    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(terms)}`;
    const searchResp = await fetch(esearchUrl);
    const searchData = await searchResp.json();
    const ids = searchData?.esearchresult?.idlist ?? [];

    if (!ids.length) {
      document.getElementById('results').innerHTML = `
        <h2>No results found</h2>
        <p>Search: ${escapeHtml(terms)}</p>`;
      return;
    }

    // 2️⃣ FETCH FULL ARTICLES (XML)
    const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
    const efetchResp = await fetch(efetchUrl);
    const xml = await efetchResp.text();

    // 3️⃣ LIGHT XML PARSING
    const articles = xml
      .split("<PubmedArticle>")
      .slice(1)
      .map((block, index) => {
        const getTagText = (tag) => {
          const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`);
          const match = block.match(re);
          return match?.[1]?.trim() ?? "N/A";
        };

        const abstractParts = [];
        const abstractRe = /<AbstractText\b[^>]*>([\s\S]*?)<\/AbstractText>/g;
        let m;
        while ((m = abstractRe.exec(block)) !== null) {
          abstractParts.push(m[1].trim());
        }
        const abstractText = abstractParts.length ? abstractParts.join("\n\n") : "N/A";

        return {
          id: ids[index],
          title: getTagText("ArticleTitle"),
          abstract: abstractText,
          journal: getTagText("Title"),
          year: getTagText("Year"),
          url: `https://pubmed.ncbi.nlm.nih.gov/${ids[index]}/`,
        };
      });

    // 4️⃣ RENDER RESULTS
    document.getElementById('results').innerHTML = articles.map(a => `
      <article>
        <h2>${escapeHtml(a.title)}</h2>
        <div class="meta">${escapeHtml(a.journal)} • ${escapeHtml(a.year)}</div>
        <pre>${escapeHtml(a.abstract)}</pre>
        <p>
          🔗 <a href="${a.url}" target="_blank" rel="noopener noreferrer">
            View on PubMed (${a.id})
          </a>
        </p>
      </article>
    `).join("");

  } catch (err) {
    console.error(err);
    document.getElementById('results').innerHTML = `
      <h2>Client Error</h2>
      <pre>${escapeHtml(err.message ?? "Unknown error")}</pre>`;
  }
}

runSearch();