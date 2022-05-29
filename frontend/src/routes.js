// Pages
import Home from "./pages/Home.svelte";

import Team from "./pages/Teams/Teams.svelte"
import TeamDetails from "./pages/Teams/TeamsDetail.svelte"
import CreateTeam from "./pages/Teams/CreateTeam.svelte"

import Event from "./pages/Events/Events.svelte"
import EventDetails from "./pages/Events/EventsDetail.svelte"
import CreateEvent from "./pages/Events/CreateEvent.svelte"


import Player from "./pages/Players/Players.svelte"
import PlayerDetails from "./pages/Players/PlayersDetail.svelte"
import CreatePlayer from "./pages/Players/CreatePlayer.svelte"
import EditPlayer from "./pages/Players/EditPlayer.svelte";

export default {
    // Home
    '/': Home,
    '/home': Home,

    // Teams
    '/teams': Team,
    '/teams/:id': TeamDetails,
    '/create-team': CreateTeam,
    
    // Players
    '/players': Player,
    '/players/:id':PlayerDetails,
    '/create-player': CreatePlayer,
    '/editplayer/:id':EditPlayer,

    //Events
    '/events': Event,
    '/events/:id' : EventDetails,
    '/create-event': CreateEvent,
}