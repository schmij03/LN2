<script>
    import axios from "axios";

    let event = {
        name: "",
        eventdate: "",
        eventinfo: "",
        teams: []
    };

    function addEvent() {
        axios.post("http://localhost:3001/api/events", event)
            .then((response) => {
                alert("Event added");
            })
            .catch((error) => {
                console.log(error);
                alert(error);
            });
            
    }
</script>

<div class="mb-5">
    <h1 class="mt-3">Add a Event</h1>

    <form>
        <div class="mb-3">
            <label for="" class="form-label">Name</label>
            <input class="form-control" type="text" bind:value={event.name} />
        </div>
        <div class="mb-3">
            <label for="" class="form-label">Durchführungsdatum</label>
            <input class="form-control" type="date" bind:value={event.eventdate} />
        </div>
        <div class="mb-3">
            <label for="" class="form-label">Eventinfo</label>
            <input class="form-control" type="text" bind:value={event.eventinfo} />
        </div>
       <a href="#/events"><button on:click={addEvent} type="button" class="btn btn-primary">
            Add Event
        </button></a> 
    </form>
</div>
