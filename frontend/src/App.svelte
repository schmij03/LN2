<script>
	import Router from "svelte-spa-router";
	import routes from "./routes";
</script>

<!-- This part is always displayed -->
<nav class="navbar navbar-expand-lg" style="background-color: #e3f2fd;">
	<div class="container-fluid">
		<a class="navbar-brand" href="#/">
	<img src= '/images/sport2.png' alt="" width="30" height="24" class="d-inline-block align-text-top">
	  Grümpi Organisator
	</a>
	  <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
		<span class="navbar-toggler-icon"></span>
	  </button>
	  <div class="collapse navbar-collapse" id="navbarSupportedContent">
		<ul class="navbar-nav me-auto mb-2 mb-lg-0">
		
		  <li class="nav-item dropdown">
			<a class="nav-link dropdown-toggle" href="#/" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
			  Players
			</a>
			<ul class="dropdown-menu" aria-labelledby="navbarDropdown">
			  <li><a class="dropdown-item" href="#/players">Player Overview</a></li>
			  <li><a class="dropdown-item" href="#/create-player">Add Player</a></li>
			 
			</ul>
		  </li>
		  <li class="nav-item dropdown">
			<a class="nav-link dropdown-toggle" href="#/teams" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
			  Teams
			</a>
			<ul class="dropdown-menu" aria-labelledby="navbarDropdown">
			  <li><a class="dropdown-item" href="#/teams">Teams Overview</a></li>
			  <li><a class="dropdown-item" href="#/create-team">Add Team</a></li>
			  </ul>
		  </li>
		  
		  <li class="nav-item dropdown">
			<a class="nav-link dropdown-toggle" href="#/teams" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
			  Events
			</a>
			<ul class="dropdown-menu" aria-labelledby="navbarDropdown">
			  <li><a class="dropdown-item" href="#/events">Events Overview</a></li>
			  <li><a class="dropdown-item" href="#/create-event">Add Events</a></li>
			  </ul>
		  </li>
		  <li class="nav-item dropdown">
			<a class="nav-link dropdown-toggle " href="#/editplayer" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
			  testing
			</a>
			<ul class="dropdown-menu" aria-labelledby="navbarDropdown">
				<li><a class="dropdown-item" href="#/editplayer">Edit Players</a></li></ul>
				
		</ul>
		
	  </div>
	</div>
  </nav>
<div class="container mt-3">
	<!-- Here we load the page depending on the current URL -->
	<Router {routes} />
</div>

<style>
</style>
