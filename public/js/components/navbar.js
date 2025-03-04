// JavaScript for toggling the Bootstrap offcanvas menu

document.addEventListener('DOMContentLoaded', () => {
    const menuIcon = document.querySelector('[data-bs-toggle="offcanvas"]');
    const offcanvasMenu = document.querySelector('.offcanvas');

    // Automatically close the offcanvas menu when clicking outside
    document.addEventListener('click', (event) => {
        if (!offcanvasMenu.contains(event.target) && !menuIcon.contains(event.target)) {
            const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasMenu);
            if (offcanvasInstance) {
                offcanvasInstance.hide();
            }
        }
    });
});
