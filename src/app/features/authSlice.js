import { createSlice } from "@reduxjs/toolkit/query"

const initialState = {
    parfums: []
}

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        getParfums: (state, action) => {
            state.parfums = [...state.parfums, action.payload]
        }
    }
})



export const { getParfums } = authSlice.actions
export default authSlice.reducer