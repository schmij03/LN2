<script>
    import axios from "axios";
    import Events from "./Events.svelte";

    export let params = {};
    let event_id;
    let team_id;

    $: {
        event_id = params.id;
        getEvent();
        getTeams();
    }

    let event = {
        _id: "",
        name: "",
        eventdate: "",
        eventinfo:"",
        teams: []
    };

    let teams = [];

    function getEvent() {
        axios.get("http://localhost:3001/api/events/" + event_id)
            .then((response) => {
                event = response.data;
            });
    }

    function getTeams() {
        axios.get("http://localhost:3001/api/teams")
            .then((response) => {
                teams = response.data;
            });
    }

    function addTeamToEvent() {
        event.teams.push(ObjectID(team_id));
        axios.put("http://localhost:3001/api/events/" + event_id, event)
            .then((response) => {
                getEvent();
            });
    }

    function deleteEvent(){
        axios.delete("http://localhost:3001/api/events/"+event_id)
        
        alert("Event has been succesfully deleted")
    }

    function editEvent(){

    }
</script>

<div class="mb-5">
    <h1 class="mt-3">Event: {event.name}</h1>
    <p>Durchführungsdatum: {event.eventdate}</p>
    <p>Eventinfo: {event.eventinfo}</p>
     
    <p>Teams:</p>
    <ul>
        {#each event.teams as team}
            <li>
                <a href={"#/teams/" + team}>{team}</a>
            </li>
        {/each}
    </ul>

    <h2>Update Teams</h2>
    <label for="team">Add Team to Event</label>
    <select class="form-select" bind:value={team_id} id="team">
        {#each teams as t}
            <option value={t._id}>{t.name}</option>
        {/each}
    </select>
    <button class="btn btn-primary mt-2" on:click={addTeamToEvent}>Update Event</button>
</div>
<a href="#/events"><button on:click={deleteEvent} type="button" class="btn btn-danger">Delete Event</button></a>
<a href={"#/events/"+event_id}><button on:click={editEvent} type="button" class="btn btn-primary">Edit Event</button></a>