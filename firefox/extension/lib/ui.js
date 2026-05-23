window.ui = {
    getScheme() {
        return document.querySelector(`${app.selectors.yt.masthead}[dark]`)
            || window.matchMedia?.('(prefers-color-scheme: dark)').matches
                ? 'dark' : 'light'
    }
};
