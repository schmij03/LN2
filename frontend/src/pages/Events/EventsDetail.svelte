<script>
    import axios from "axios";
    import Events from "./Events.svelte";

    export let params = {};
    let event_id;
    let team_id;
    let length;
    let posofteam;
    $: {
        event_id = params.id;
        getEvent();
        getTeams();
    }

    let event = {
        _id: "",
        name: "",
        eventdate: "",
        eventinfo: "",
        teams: [],
        pinevent: [],
    };

    let teams = [];

    function getEvent() {
        axios
            .get("http://localhost:3001/api/events2/" + event_id)
            .then((response) => {
                event = response.data;
            });
    }

    function getTeams() {
        axios.get("http://localhost:3001/api/teams").then((response) => {
            teams = response.data;
        });
    }

    function addTeamToEvent() {
        if (event.teams.includes(team_id)) {
            alert("Team already exists in this Event");
        } else {
            event.teams.push(team_id);
            axios
                .put("http://localhost:3001/api/events/" + event_id, event)
                .then((response) => {
                    getEvent();
                });
        }
    }

    function deleteEvent() {
        axios.delete("http://localhost:3001/api/events/" + event_id);

        alert("Event has been succesfully deleted");
    }
function editEvent(){}
    function deleteTeam() {
        if (!event.teams.includes(team_id)) {
            alert("Team not found in event");
        } else {
            length = event.teams.length;
            posofteam = event.teams.indexOf(team_id);
            event.teams.splice(posofteam, length);
            axios
                .put("http://localhost:3001/api/events/" + event_id, event)
                .then((response) => {
                    getEvent();
                });
            alert("Team has been deleted from Event!");
        }
    }
</script>

<div class="mb-5">
    <a href="#/events"
    ><button on:click={deleteEvent} type="button" class="btn btn-danger"
        >Delete Event</button
    ></a
>
<a href={"#/editevent/" + event_id}
    ><button on:click={editEvent} type="button" class="btn btn-primary"
        >Edit Event</button
    ></a
>
    <h1 class="mt-3">Event: {event.name}</h1>
    <p>Durchführungsdatum: {event.eventdate}</p>
    <p>Eventinfo: {event.eventinfo}</p>

    <p>Teams:</p>
    <ul>
        {#each event.pinevent as e}
            <li>
                <a href={"#/teams/" + e._id}>{e.name}</a>
            </li>
        {/each}
    </ul>

    <h2>Update Teams:</h2>
    <label for="team">Choose team:</label>
    <select class="form-select" bind:value={team_id} id="team">
        {#each teams as t}
            <option value={t._id}>{t.name}</option>
        {/each}
    </select>
    <button on:click={deleteTeam} class="btn btn-warning mt-2">
        Delete Player</button
    >
    <button class="btn btn-success mt-2" on:click={addTeamToEvent}
        >Add Team</button
    >
</div>

