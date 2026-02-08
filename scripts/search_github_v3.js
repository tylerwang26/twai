async function search() {
    const queries = [
        'taiwan stock strategy stars:>50',
        '"台股" 策略 stars:>20',
        '"三大法人" 策略',
        'Taiwan Stock Screening'
    ];
    let results = [];
    for (const q of queries) {
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars`;
        const response = await fetch(url, { headers: { 'User-Agent': 'Moltbot-Agent' } });
        const data = await response.json();
        if (data.items) {
            results = results.concat(data.items.slice(0, 5).map(i => ({ name: i.full_name, desc: i.description, stars: i.stargazers_count, url: i.html_url })));
        }
    }
    console.log(JSON.stringify(results, null, 2));
}
search();
