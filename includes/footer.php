<?php
if (!defined('AB_STORE')) {
    http_response_code(403);
    exit;
}

$page_scripts = isset($page_scripts) && is_array($page_scripts) ? $page_scripts : [];
?>
<footer>
    <div class="container">
        <div class="row gy-4">
            <div class="col-lg-4 col-md-6">
                <div class="footer-brand">AB Store</div>
                <div class="footer-tagline">Qalqilya Boutique · Est. 2026</div>
                <p class="footer-about">
                    Visit our boutique in Qalqilya for fragrance guidance, signature scents, and tailored support from the AB Store team.
                </p>
                <div class="footer-social mt-3">
                    <a href="#" class="soc" aria-label="Instagram"><i class="bi bi-instagram"></i></a>
                    <a href="#" class="soc" aria-label="Facebook"><i class="bi bi-facebook"></i></a>
                    <a href="#" class="soc" aria-label="Pinterest"><i class="bi bi-pinterest"></i></a>
                </div>
            </div>
            <div class="col-lg-2 col-md-3 col-6">
                <p class="footer-heading">Navigate</p>
                <ul class="footer-links">
                    <li><a href="/index.html">Home</a></li>
                    <li><a href="/products.html">Products</a></li>
                    <li><a href="/about.html">About Us</a></li>
                    <li><a href="/contact.html">Contact</a></li>
                    <li><a href="/loyalty.html">Loyalty</a></li>
                </ul>
            </div>
            <div class="col-lg-2 col-md-3 col-6">
                <p class="footer-heading">Collections</p>
                <ul class="footer-links">
                    <li><a href="/products.html">For Her</a></li>
                    <li><a href="/products.html">For Him</a></li>
                    <li><a href="/products.html">Unisex</a></li>
                    <li><a href="/products.html">Niche</a></li>
                </ul>
            </div>
            <div class="col-lg-4 col-md-6">
                <p class="footer-heading">Contact</p>
                <ul class="footer-links">
                    <li><a href="/contact.html">Qalqilya, West Bank, Palestine</a></li>
                    <li><a href="tel:+970594369494">+970 59-4369494</a></li>
                    <li><a id="shared-footer-email" href="mailto:contact@abstore.com">contact@abstore.com</a></li>
                    <li><a href="mailto:orders@abstore.com">orders@abstore.com</a></li>
                    <li><a href="/contact.html">Sun - Thu: 10:00 - 20:00</a></li>
                    <li><a href="/contact.html">Saturday: 10:00 - 16:00</a></li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; <?= e(date('Y')) ?> AB Store. All rights reserved.</p>
            <p id="shared-footer-meta">Contact us for boutique support, orders, and fragrance consultations.</p>
        </div>
    </div>
</footer>

<div id="floatLogo">
    <div class="float-ring float-ring-1"></div>
    <div class="float-ring float-ring-2"></div>
    <div class="float-ring float-ring-3"></div>
    <div class="float-particles">
        <span></span><span></span><span></span>
        <span></span><span></span><span></span>
    </div>
    <img src="/images/logo.webp" alt="AB Store" id="floatLogoImg" />
</div>

<div class="cart-toast" id="cartToast"></div>

<script>
(function () {
    const nav = document.getElementById('mainNav');
    if (nav) {
        const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobileNav');
    if (hamburger && mobileNav) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('open');
            mobileNav.classList.toggle('open');
        });
        mobileNav.querySelectorAll('a').forEach((a) =>
            a.addEventListener('click', () => {
                hamburger.classList.remove('open');
                mobileNav.classList.remove('open');
            })
        );
    }

    const floatLogo = document.getElementById('floatLogo');
    if (floatLogo) {
        const onScrollFloat = () => floatLogo.classList.toggle('float-visible', window.scrollY > 400);
        window.addEventListener('scroll', onScrollFloat, { passive: true });
        floatLogo.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        onScrollFloat();
    }

    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    io.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
        document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    } else {
        document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
    }
})();
</script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script src="/assets/js/ajax.js"></script>
<script src="/js-files/float-logo.js"></script>
<?php foreach ($page_scripts as $script_src): ?>
<script src="<?= e($script_src) ?>"></script>
<?php endforeach; ?>
