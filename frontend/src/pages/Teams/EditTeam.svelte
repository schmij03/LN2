<script>
    import axios from "axios";

    export let params = {};
    let team_id;
    let player_id;
    let players = [];

    let sports = [
        "Fussball",
        "Eishockey",
        "Pingpong",
        "Tennis",
        "Leichtathletik",
        "Unihockey",
        "Baseball",
        "Volleyball",
        "Basketball",
    ];
    let teams = {};

    function editTeam() {
        axios
            .put("http://localhost:3001/api/teams/" + team_id, teams)
            .then((response) => {});
        alert("Team angepasst");
    }
    $: {
        team_id = params.id;
        getTeam();
        getPlayers();
    }
    function getTeam() {
        axios
            .get("http://localhost:3001/api/teams/" + team_id)
            .then((response) => {
                teams = response.data;
            });
    }
    function getPlayers() {
        axios.get("http://localhost:3001/api/players").then((response) => {
            players = response.data;
        });
    }
</script>

<div class="mb-5">
    <h1 class="mt-3">Edit a Team</h1>
    <form>
        <div class="mb-3">
            <label for="Name"class="form-label">Name: <input class="form-control" bind:value={teams.name} /></label>
        </div>
        <div class="mb-3">
            <label for=""class="form-label"
                >Sportart: <select
                    class="form-select"
                    bind:value={teams.sportart}
                    id="team"
                >
                    {#each sports as t}
                        <option value={t}>{t}</option>
                    {/each}
                </select></label
            >
        </div>
    </form>

    <a href={"#/teams/" + team_id}
        ><button type="button" class="btn btn-secondary">Cancel</button></a
    >
    <a href={"#/teams/" + team_id}
        ><button on:click={editTeam} type="button" class="btn btn-primary"
            >Ok</button
        ></a
    >
</div>
