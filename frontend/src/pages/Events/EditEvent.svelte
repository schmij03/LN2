<script>
    import axios from "axios";

    export let params = {};
    let team_id;
    let event_id;
    let teams = [];

    let events = {};

    function editEvent() {
        axios
            .put("http://localhost:3001/api/events/" + event_id, events)
            .then((response) => {});
        alert("Event angepasst");
    }
    $: {
        event_id = params.id;
        getEvent();
        getTeams();
    }
    function getEvent() {
        axios
            .get("http://localhost:3001/api/events/" + event_id)
            .then((response) => {
                events = response.data;
            });
    }
    function getTeams() {
        axios.get("http://localhost:3001/api/teams").then((response) => {
            teams = response.data;
        });
    }
</script>

<div class="mb-5">
    <h1 class="mt-3">Edit a Event</h1>
    <br />
    <form>
        <div class="mb-3">
            <label for="Name" class="form-label"
                >Name: <input bind:value={events.name} class="form-control"/></label
            >
        </div>

        <div class="mb-3">
            <label for="" class="form-label"
                >Aktuelles Durchführungsdatum: {events.eventdate}</label
            >
        </div>

        <div class="mb-3">
            <label for="Name" class="form-label"
                >Neues Durchführungsdatum: <input class="form-control"
                    bind:value={events.eventdate}
                    type="date"
                /></label
            >
        </div>
        <div class="mb-3">
            <label for="Name" class="form-label"
                >Eventinfo: <input class="form-control" bind:value={events.eventinfo} /></label
            >
        </div>
    </form>
    <br />
    <a href={"#/events/" + event_id}
        ><button type="button" class="btn btn-secondary">Cancel</button></a
    >
    <a href={"#/events/" + event_id}
        ><button on:click={editEvent} type="button" class="btn btn-primary"
            >Ok</button
        ></a
    >
</div>
