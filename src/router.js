/**
 * Router Class
 * Handles client-side view switching.
 */

export class Router {
    constructor(appElement, routes) {
        this.app = appElement;
        this.routes = routes;
        
        window.addEventListener('popstate', () => this.renderCurrentRoute());
    }

    navigateTo(path) {
        window.history.pushState({}, '', path);
        this.renderCurrentRoute();
    }

    renderCurrentRoute() {
        const path = window.location.pathname;
        const route = this.routes[path] || this.routes['/login'];
        
        // Clear app and render new view
        this.app.innerHTML = '';
        route(this.app);
    }

    init() {
        this.renderCurrentRoute();
    }
}
