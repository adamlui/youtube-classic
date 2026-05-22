window.ui = {
    getScheme() {
        return document.querySelector('ytd-masthead[dark]')
            || window.matchMedia?.('(prefers-color-scheme: dark)').matches
                ? 'dark' : 'light'
    }
};
