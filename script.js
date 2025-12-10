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
      <h1>Error</h1>
      <p>Please provide <code>?terms=</code></p>`;
    // Show the body AFTER JS runs
    document.body.style.visibility = 'visible';
    return;
  }

  try {
    // Search PubMed
    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(terms)}`;
    const searchResp = await fetch(esearchUrl);
    const searchData = await searchResp.json();
    const ids = searchData?.esearchresult?.idlist ?? [];

    if (!ids.length) {
      document.getElementById('results').innerHTML = `
        <h1>No results found</h1>
        <p>Search: ${escapeHtml(terms)}</p>`;
      document.body.style.visibility = 'visible';
      return;
    }

    // Fetch article details
    const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
    const efetchResp = await fetch(efetchUrl);
    const xml = await efetchResp.text();

    const articles = xml
      .split("<PubmedArticle>").slice(1)
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

    // Build output HTML
    const html = `<h1>PubMed Results for: "${escapeHtml(terms)}"</h1>` +
      articles.map(a => `
        <article>
          <h2>${escapeHtml(a.title)}</h2>
          <div class="meta">${escapeHtml(a.journal)} • ${escapeHtml(a.year)}</div>
          <pre>${escapeHtml(a.abstract)}</pre>
          <p>🔗 <a href="${a.url}" target="_blank" rel="noopener noreferrer">
            View on PubMed (${a.id})
          </a></p>
        </article>
      `).join("");

    // Render the data
    document.getElementById('root').innerHTML = html;

  } catch (err) {
    console.error(err);
    document.getElementById('results').innerHTML = `
      <h1>Client Error</h1>
      <pre>${escapeHtml(err.message ?? "Unknown error")}</pre>`;
  }

  // Reveal the page only after JS completes
  document.body.style.visibility = 'visible';
}

runSearch();