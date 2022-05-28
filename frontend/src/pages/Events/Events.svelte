<script>
    import axios from "axios";

    let events = [];

    function getEvent() {
        axios.get("http://localhost:3001/api/events").then((response) => {
            events = response.data;
        });
    }
    getEvent();
</script>

<div class="mb-5">
    <h1 class="mt-3">List of all Events</h1>

    <a href="#/create-event"><button type="button" class="btn btn-primary">Add Event </button></a>

    <table class="table table-striped table-hover">
        <thead>
            <tr>
                
                <th>Name</th>
                <th>Durchführungsdatum</th>
                <th>Eventinfo</th>
                 </tr>
        </thead>
        <tbody>
            {#each events as event}
                <tr>
                    <td>
                        
                            {event.name}
                        
                    </td>
                    
                    <td>
                        {event.eventdate}
                    </td>
                    <td>
                        <a href={"#/events/" + event._id}>
                        {event.eventinfo}
                    </a>
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
