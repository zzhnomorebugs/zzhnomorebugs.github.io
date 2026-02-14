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

  // init smooth scroll, this needs to be slightly more than then fixed masthead height
  $("a").smoothScroll({offset: -65});

  // add lightbox class to all image links
  $("a[href$='.jpg'],a[href$='.jpeg'],a[href$='.JPG'],a[href$='.png'],a[href$='.gif']").addClass("image-popup");

  // Magnific-Popup options
  $(".image-popup").magnificPopup({
    type: 'image',
    tLoading: 'Loading image #%curr%...',
    gallery: {
      enabled: true,
      navigateByImgClick: true,
      preload: [0,1] // Will preload 0 - before current, and 1 after the current image
    },
    image: {
      tError: '<a href="%url%">Image #%curr%</a> could not be loaded.',
    },
    removalDelay: 500, // Delay in milliseconds before popup is removed
    // Class that is added to body when popup is open.
    // make it unique to apply your CSS animations just to this exact popup
    mainClass: 'mfp-zoom-in',
    callbacks: {
      beforeOpen: function() {
        // just a hack that adds mfp-anim class to markup
        this.st.image.markup = this.st.image.markup.replace('mfp-figure', 'mfp-figure mfp-with-anim');
      }
    },
    closeOnContentClick: true,
    midClick: true // allow opening popup on middle mouse click. Always set it to true if you don't provide alternative source.
  });

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
