/*
 * Legacy global script, loaded by includes/footer.php on auth/admin pages.
 *
 * Previously contained product grid, cart, wishlist, search and pagination
 * handlers wired to selectors (#products-grid, #cart-page-items, #hero-search,
 * .js-add-to-cart, .js-toggle-wishlist, .js-page-link) that do not exist
 * anywhere in the project. The storefront flow now lives in:
 *   - js-files/pages/cart.js      (cart page)
 *   - js-files/products.js        (products page + wishlist)
 *   - js-files/pages/home.js      (home featured grid + add-to-cart)
 *
 * The only behavior in this file still used by any page is the image preview
 * for admin product upload forms (.js-image-preview-input).
 */
document.addEventListener('DOMContentLoaded', () => {
    function fill_image_preview(input) {
        const preview_id = input.dataset.previewTarget ?? '';
        const placeholder_id = input.dataset.previewPlaceholder ?? '';
        const preview = document.getElementById(preview_id);
        const placeholder = document.getElementById(placeholder_id);
        const file = input.files?.[0] ?? null;

        if (!preview || !placeholder) {
            return;
        }

        if (!file) {
            preview.src = '';
            preview.classList.add('d-none');
            placeholder.classList.remove('d-none');
            return;
        }

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            preview.src = String(reader.result ?? '');
            preview.classList.remove('d-none');
            placeholder.classList.add('d-none');
        });
        reader.readAsDataURL(file);
    }

    function handle_change(event) {
        const target = event.target;
        if (target instanceof HTMLInputElement && target.classList.contains('js-image-preview-input')) {
            fill_image_preview(target);
        }
    }

    function handle_click(event) {
        const delete_button = event.target.closest('.js-confirm-delete');
        if (delete_button && !window.confirm('Delete this product? This action cannot be undone.')) {
            event.preventDefault();
        }
    }

    document.addEventListener('change', handle_change);
    document.addEventListener('click', handle_click);
});
