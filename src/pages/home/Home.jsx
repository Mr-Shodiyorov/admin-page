import React from 'react'
import { useGetProductsQuery } from '../../app/services/authApi'
import Header from './Header'
import Hero from '../Hero'

function Home() {
    const { data, isLoading, error } = useGetProductsQuery()
    return (
        <>
            <Header />
            <main>

            <Hero />
            </main>
        </>
    )
}

export default Home