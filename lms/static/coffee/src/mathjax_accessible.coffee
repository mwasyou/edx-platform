$ ->
	isMPInstalled = (boolean) ->
	# check if MathPlayer is installed
	# (from http://www.dessci.com/en/products/mathplayer/check.htm)
		try
			oMP = new ActiveXObject("MathPlayer.Factory.1")
			true
		catch e
			false

	isBrowserCompatible = (boolean) ->
		if $.browser.msie and $.browser.version >= 6 and $.browser.version <=9
			true
		false

	# detect if there is mathjax on the page
	# if not, set 'aria-hidden' to 'true'
	if MathJax? and not isMPInstalled()
		$("#mathjax-accessibility-message").attr("aria-hidden", "false")
	else
		$("#mathjax-accessibility-message").attr("aria-hidden", "true")

	if isBrowserCompatible()
		$("#mathplayer-browser-message").attr("aria-hidden", "true")

	else
		$("#mathplayer-browser-message").attr("aria-hidden", "false")