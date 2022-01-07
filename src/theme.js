var jQuery = (typeof(window) != 'undefined') ? window.jQuery : require('jquery');

// Sphinx theme nav state
function ThemeNav () {

    var nav = {
        navBar: null,
        win: null,
        winScroll: false,
        winResize: false,
        linkScroll: false,
        winPosition: 0,
        winHeight: null,
        docHeight: null,
        isRunning: false
    };

    nav.enable = function (withStickyNav) {
        var self = this;

        // TODO this can likely be removed once the theme javascript is broken
        // out from the RTD assets. This just ensures old projects that are
        // calling `enable()` get the sticky menu on by default. All other cals
        // to `enable` should include an argument for enabling the sticky menu.
        if (typeof(withStickyNav) == 'undefined') {
            withStickyNav = true;
        }

        if (self.isRunning) {
            // Only allow enabling nav logic once
            return;
        }

        self.isRunning = true;
        jQuery(function ($) {
            self.init($);

            self.reset();
            self.win.on('hashchange', function() { self.reset(); });

            if (withStickyNav) {
                // Set scroll monitor
                self.win.on('scroll', function () {
                    if (!self.linkScroll) {
                        if (!self.winScroll) {
                            self.winScroll = true;
                            requestAnimationFrame(function() { self.onScroll(); });
                        }
                    }
                });
            }

            // Set resize monitor
            self.win.on('resize', function () {
                if (!self.winResize) {
                    self.winResize = true;
                    requestAnimationFrame(function() { self.onResize(); });
                }
            });

            self.onResize();
        });

    };

    // TODO remove this with a split in theme and Read the Docs JS logic as
    // well, it's only here to support 0.3.0 installs of our theme.
    nav.enableSticky = function() {
        this.enable(true);
    };

    nav.init = function ($) {
        var doc = $(document),
            self = this;

        this.navBar = $('div.wy-side-scroll:first');
        this.win = $(window);

        if (this.isDisplayed()) {
          this.makeMenuFocusable()
        } else {
          this.makeMenuUnfocusable();
        }

        // Set up javascript UX bits
        $(document)
            // Shift nav in mobile when clicking the menu.
            .on('click', "[data-toggle='wy-nav-top']", function() {
                $("[data-toggle='wy-nav-shift']").toggleClass("shift");
                $("[data-toggle='rst-versions']").toggleClass("shift");

                if (self.isDisplayed()) {
                  self.makeMenuFocusable();
                  $('.wy-side-nav-search input').focus();
                } else {
                  self.makeMenuUnfocusable();
                }
            })

            // Nav menu link click operations
            .on('click', ".wy-menu-vertical .current ul li a", function() {
                var target = $(this);
                // Close menu when you click a link.
                $("[data-toggle='wy-nav-shift']").removeClass("shift");
                $("[data-toggle='rst-versions']").toggleClass("shift");
                // Handle dynamic display of l3 and l4 nav lists
                self.toggleCurrent(target);
                self.hashChange();
            })
            .on('click', "[data-toggle='rst-current-version']", function() {
                var target = $(this);
                $("[data-toggle='rst-versions']").toggleClass("shift-up");
                target.attr(
                    'aria-expanded',
                    $("[data-toggle='rst-versions']").hasClass("shift-up") ?
                        "true" : "false"
                );
            })

        // Make tables responsive
        $("table.docutils:not(.field-list,.footnote,.citation)")
            .wrap("<div class='wy-table-responsive'></div>");

        // Add extra class to responsive tables that contain
        // footnotes or citations so that we can target them for styling
        $("table.docutils.footnote")
            .wrap("<div class='wy-table-responsive footnote'></div>");
        $("table.docutils.citation")
            .wrap("<div class='wy-table-responsive citation'></div>");

        // Add expand links to all parents of nested ul
        $('.wy-menu-vertical ul').not('.simple').siblings('a').each(function () {
            var link = $(this),
                expand = $('<button class="toctree-expand"></button>');

            expand
                .attr('title', "Sub-menu for " + link.text())
                .attr('aria-expanded','false');

            expand.on('click', function (ev) {
                self.toggleCurrent(link);
                ev.stopPropagation();
                return false;
            });
            link.prepend(expand);
        });

        // provide better aria landmarks
        $('.wy-menu p.caption')
            .attr('role', 'heading')
            .attr('aria-level', '2');
        $('.wy-menu ul').each(function() {
            var groupHeading = $(this).prev().text();
            if (groupHeading != "Contents:") {
                $(this).attr({
                    'aria-label': groupHeading + ' links group'
                });
                $(this).find('li a').each(function() {
                    var linkTxt = $(this).clone().children('button').remove().end().text();
                    $(this).attr('aria-label',groupHeading + ', ' + linkTxt);
                });
            }
        });

		// wait for RTD to mess with our page, then get the
		// last word to change the version picker for accessibility
		var Mut = window.MutationObserver
			|| window.WebKitMutationObserver;
		var observer = new Mut(function(mutations, observer) {
			if ($('.rst-other-versions .injected').length > 0)
			{
				observer.disconnect();
				console.log("Rewriting version picker for accessibility");
				nav.rewriteVersionPicker();
			}
		});
		var picker = $('.rst-other-versions');
		if (picker.length > 0)
		{
			observer.observe(picker[0], {
				subtree: true,
				childList: true
			});
		}
		else
			console.log("No version picker to rewrite");
    };

    nav.reset = function () {
        // Get anchor from URL and open up nested nav
        var anchor = encodeURI(window.location.hash) || '#';

        try {
            var vmenu = $('.wy-menu-vertical');
            var link = vmenu.find('[href="' + anchor + '"]');
            if (link.length === 0) {
                // this link was not found in the sidebar.
                // Find associated id element, then its closest section
                // in the document and try with that one.
                var id_elt = $('.document [id="' + anchor.substring(1) + '"]');
                var closest_section = id_elt.closest('div.section');
                link = vmenu.find('[href="#' + closest_section.attr("id") + '"]');
                if (link.length === 0) {
                    // still not found in the sidebar. fall back to main section
                    link = vmenu.find('[href="#"]');
                }
            }
            // If we found a matching link then reset current and re-apply
            // otherwise retain the existing match
            if (link.length > 0) {
                $('.wy-menu-vertical .current').removeClass('current');
                link.addClass('current');
                link.closest('li.toctree-l1').parent().addClass('current');
                for (let i = 1; i <= 10; i++) {
                    link.closest('li.toctree-l' + i).addClass('current');
                }
                link[0].scrollIntoView();
            }
            this.updateAria();
        }
        catch (err) {
            console.log("Error expanding nav for anchor", err);
        }

    };

    nav.onScroll = function () {
        this.winScroll = false;
        var newWinPosition = this.win.scrollTop(),
            winBottom = newWinPosition + this.winHeight,
            navPosition = this.navBar.scrollTop(),
            newNavPosition = navPosition + (newWinPosition - this.winPosition);
        if (newWinPosition < 0 || winBottom > this.docHeight) {
            return;
        }
        this.navBar.scrollTop(newNavPosition);
        this.winPosition = newWinPosition;
    };

    nav.onResize = function () {
        this.winResize = false;
        this.winHeight = this.win.height();
        this.docHeight = $(document).height();

        if (this.isDisplayed()) {
          this.makeMenuFocusable()
        } else {
          this.makeMenuUnfocusable();
        }
    };

    nav.hashChange = function () {
        this.linkScroll = true;
        this.win.one('hashchange', function () {
            this.linkScroll = false;
        });
    };

    nav.toggleCurrent = function (elem) {
        var parent_li = elem.closest('li');
        parent_li.siblings('li.current').removeClass('current');
        parent_li.siblings().find('li.current').removeClass('current');
        var children = parent_li.find('> ul li');
        // Don't toggle terminal elements.
        if (children.length) {
            children.removeClass('current');
            parent_li.toggleClass('current');
        }
        this.updateAria();
    }

    nav.updateAria = function() {
        // collapsed until proven expanded
        $('button.toctree-expand').attr('aria-expanded','false');
        // mark expanded
        $('.wy-side-scroll li.current > a > button.toctree-expand')
            .attr('aria-expanded','true');
    }

    nav.isDisplayed = function() {
        return $("[data-toggle='wy-nav-shift']").css("left") === "0px";
    }

    nav.menuElements = function() {
        return $(".wy-side-nav-search > a")
            .add(".rst-versions button")
            .add(".wy-side-nav-search input")
            .add(".wy-menu a")
            .add(".wy-menu button");
    }

    nav.makeMenuFocusable = function() {
        this.menuElements().removeAttr("tabindex");
    }

    nav.makeMenuUnfocusable = function() {
        this.menuElements().attr("tabindex", -1);
    }

    /* transform markup that Read The Docs injects after page load */
    nav.rewriteVersionPicker = function() {
        var picker = $('.rst-other-versions');
        var dest = $('<div class="replaced" />');
        picker.find('dl').each(function () {
            var dl = $(this),
                header = $('<h3 class="label" />');
            header.text(dl.find('dt').text())
            dest.append(header);

            var dds = dl.find('dd');
            if (dds.length > 1)
            {
                var items = $('<ul />');
                dds.each(function () {
                    var dd = $(this),
                        li = $('<li />');
                    li.html(dd.html());
                    items.append(li);
                });
                dest.append(items);
            }
            else if (dds.length == 1)
                dest.append(dds[0].innerHTML);
        });
        picker.find('.injected').replaceWith(dest);
    }

    return nav;
};

module.exports.ThemeNav = ThemeNav();

if (typeof(window) != 'undefined') {
    window.SphinxRtdTheme = {
        Navigation: module.exports.ThemeNav,
        // TODO remove this once static assets are split up between the theme
        // and Read the Docs. For now, this patches 0.3.0 to be backwards
        // compatible with a pre-0.3.0 layout.html
        StickyNav: module.exports.ThemeNav,
    };
}


// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
// https://gist.github.com/paulirish/1579671
// MIT license

(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

$(document).ready(function() {
    $('.headerlink').each(function() {
      titleText = $(this).parent().clone().children('.headerlink').remove().end().text();
      $(this).attr('title', 'Permalink to ' + titleText);
    });
    $('.rst-other-versions').attr('tabindex', '-1');
    const vPicker = $(".rst-versions");
    $(vPicker).focusin(function() {
      isFocused = true;
    });
    $(vPicker).focusout(function() {
      //var elem = $(this);
      isFocused = false;
      setTimeout(function() {
        if (!isFocused && $(vPicker).hasClass("shift-up")) {
          $(vPicker).removeClass("shift-up");
          $(".rst-current-version").attr("aria-expanded", "false");
        }
      }, 100);
    });
    if($('#maincontent').length === 0){
        $('[itemprop=articleBody]').prepend('<a id="maincontent" name="maincontent"></a>');
    };
    if($('.wy-side-nav-search .skiplink').length === 0){
        $('.wy-side-nav-search').prepend('<a class="skiplink" href="#maincontent">Skip to main content &gt;</a>');
    };
});
