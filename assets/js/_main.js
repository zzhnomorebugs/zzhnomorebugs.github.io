/* ==========================================================================
   jQuery plugin settings and other scripts
   ========================================================================== */

$(document).ready(function(){
  // These should be the same as the settings in _variables.scss
  scssLarge = 925; // pixels

  // Sticky footer
  var bumpIt = function() {
      $("body").css("margin-bottom", $(".page__footer").outerHeight(true));
    },
    didResize = false;

  bumpIt();

  $(window).resize(function() {
    didResize = true;
  });
  setInterval(function() {
    if (didResize) {
      didResize = false;
      bumpIt();
    }
  }, 250);
  
  // FitVids init
  fitvids();

  // Follow menu drop down
  $(".author__urls-wrapper button").on("click", function() {
    $(".author__urls").fadeToggle("fast", function() {});
    $(".author__urls-wrapper button").toggleClass("open");
  });

  // Restore the follow menu if toggled on a window resize
  jQuery(window).on('resize', function() {
    if ($('.author__urls.social-icons').css('display') == 'none' && $(window).width() >= scssLarge) {
      $(".author__urls").css('display', 'block')
    }
  });    

  // init smooth scroll for same-page hash links only
  $('a[href*="#"]:not([href="#"]):not(.image-popup)').filter(function() {
    return this.hash && document.getElementById(this.hash.slice(1));
  }).smoothScroll({offset: -65});

  // add lightbox class to image links (supports query strings in URL)
  $('a[href]').filter(function() {
    return /\.(jpe?g|png|gif)(\?|#|$)/i.test(this.getAttribute('href'));
  }).addClass('image-popup');

  var imagePopupOptions = {
    type: 'image',
    tLoading: 'Loading image #%curr%...',
    gallery: {
      enabled: true,
      navigateByImgClick: true,
      preload: [0, 1]
    },
    image: {
      tError: '<a href="%url%">Image #%curr%</a> could not be loaded.',
    },
    removalDelay: 500,
    mainClass: 'mfp-zoom-in',
    callbacks: {
      beforeOpen: function() {
        var markup = this.st.image.markup;
        if (markup.indexOf('mfp-with-anim') === -1) {
          this.st.image.markup = markup.replace('mfp-figure', 'mfp-figure mfp-with-anim');
        }
      },
      open: function() {
        $(document).off('focusin.mfp');
      }
    },
    closeOnContentClick: true,
    midClick: true
  };

  $('.recent-highlight-card__poster .image-popup').magnificPopup(imagePopupOptions);
  $('.image-popup').not('.recent-highlight-card__poster .image-popup').magnificPopup(imagePopupOptions);

  // Publications navigation scroll highlighting
  if ($('#publications-nav').length > 0) {
    var publicationsNav = $('#publications-nav');
    var navLinks = publicationsNav.find('.publications-nav__link');
    var publications = $('.archive__item[id^="publication-"]');
    
    function updateActiveNav() {
      var scrollTop = $(window).scrollTop();
      var mastheadHeight = 64; // Should match $masthead-height
      var offset = mastheadHeight + 100;
      
      var current = '';
      publications.each(function() {
        var publication = $(this);
        var publicationTop = publication.offset().top - offset;
        
        if (scrollTop >= publicationTop) {
          current = publication.attr('id');
        }
      });
      
      navLinks.removeClass('active');
      if (current) {
        navLinks.filter('[href="#' + current + '"]').addClass('active');
      }
    }
    
    // Update on scroll
    $(window).on('scroll', function() {
      updateActiveNav();
    });
    
    // Update on page load
    updateActiveNav();
    
    // Smooth scroll for nav links
    navLinks.on('click', function(e) {
      e.preventDefault();
      var target = $(this).attr('href');
      if (target) {
        var targetElement = $(target);
        if (targetElement.length) {
          $('html, body').animate({
            scrollTop: targetElement.offset().top - 64
          }, 500);
        }
      }
    });
  }

});
