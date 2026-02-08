async function getRepoContents(owner, repo, path = '') {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Moltbot-Agent' } });
        const data = await response.json();
        if (Array.isArray(data)) {
            console.log(JSON.stringify(data.map(item => ({ name: item.name, type: item.type })), null, 2));
        } else {
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

getRepoContents('LongOnly', 'Quantitative-Notebooks', '');
