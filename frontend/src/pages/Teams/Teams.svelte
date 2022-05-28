<script>
    import axios from "axios";

    let teams = [];

    function getTeams() {
        axios.get("http://localhost:3001/api/teams").then((response) => {
            teams = response.data;
        });
    }
    getTeams();
</script>

<div class="mb-5">
    <h1 class="mt-3">List of all Teams</h1>
    <a href="#/create-team"
        ><button type="button" class="btn btn-primary">Add Team </button></a
    >
    <table class="table table-striped table-hover">
        <thead>
            <tr>
                <th>Name</th>
                <th>Sportart</th>
                <th>Teaminfo</th>
            </tr>
        </thead>
        <tbody>
            {#each teams as team}
                <tr>
                    <td>
                        {team.name}
                    </td>
                    <td>{team.sportart} </td>
                    <td><a href={"#/teams/" + team._id}> Details </a> </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
