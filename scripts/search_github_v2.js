async function searchGithub() {
    const query = encodeURIComponent('fundamental technical analysis stock trading stars:>100');
    const url = `https://api.github.com/search/repositories?q=${query}&sort=stars`;
    
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Moltbot-Agent' }
        });
        const data = await response.json();
        
        const results = data.items.map(item => ({
            name: item.full_name,
            stars: item.stargazers_count,
            description: item.description,
            url: item.html_url
        }));
        
        console.log(JSON.stringify(results.slice(0, 10), null, 2));
    } catch (e) {
        console.error(e);
    }
}

searchGithub();
